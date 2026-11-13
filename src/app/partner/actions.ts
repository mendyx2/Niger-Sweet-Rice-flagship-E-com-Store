"use server";

import { z } from "zod";
import { refresh, updateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { changeOrderStatus, confirmTransferReceived, reportTransferNotReceived } from "@/lib/order-actions";
import { moveStock } from "@/lib/stock";
import { nairaToKobo, formatNaira } from "@/lib/money";
import { withinBand } from "@/lib/network-rules";
import { alertHq } from "@/lib/notify";
import { normalizeNgPhone, maskPhone } from "@/lib/phone";
import { makeReferralCode } from "@/lib/auth";
import { sendSms } from "@/lib/sms";
import { site } from "@/lib/site";
import { TAGS } from "@/lib/catalogue";

export type FormState = { ok: boolean; message: string } | null;

// ─── Orders ─────────────────────────────────────────────────────────────────

export async function partnerPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const { distributor, actor } = await requirePartner();
  const orderId = String(formData.get("orderId") ?? "");
  const r = formData.get("decision") === "not_received"
    ? await reportTransferNotReceived(orderId, actor, distributor.id)
    : await confirmTransferReceived(orderId, actor, distributor.id);
  if (r.ok) refresh();
  return r;
}

const statusInput = z.object({
  orderId: z.string().max(40),
  status: z.enum(["PROCESSING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED_DELIVERY", "CANCELLED"]),
  riderName: z.string().trim().max(80).optional(),
  riderPhone: z.string().trim().max(20).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function partnerStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const { distributor, actor } = await requirePartner();
  const parsed = statusInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  if (parsed.data.status === "CANCELLED") {
    // Distributors may cancel unpaid orders; paid orders are cancelled by HQ (refund needed).
    const o = await db.order.findUnique({ where: { id: parsed.data.orderId } });
    if (o?.status !== "PENDING_PAYMENT") return { ok: false, message: "Paid orders can only be cancelled by HQ. Please contact HQ." };
  }
  const r = await changeOrderStatus({ ...parsed.data, actor, distributorId: distributor.id });
  if (r.ok) refresh();
  return r;
}

// ─── Stock ──────────────────────────────────────────────────────────────────

/** Confirm a delivery from HQ. Anything short is recorded and HQ is alerted. */
export async function receiveStock(_prev: FormState, formData: FormData): Promise<FormState> {
  const { distributor, actor } = await requirePartner();
  const stock = await db.distributorStock.findMany({ where: { distributorId: distributor.id, inTransit: { gt: 0 } }, include: { variant: true } });
  if (!stock.length) return { ok: false, message: "Nothing is in transit to you." };
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 60) || undefined;
  const shortages: string[] = [];
  const received: string[] = [];
  for (const s of stock) {
    const raw = formData.get(`received:${s.variantId}`);
    const n = raw === null || raw === "" ? NaN : Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > s.inTransit) return { ok: false, message: `${s.variant.sizeKg}kg: enter a number from 0 to ${s.inTransit}.` };
  }
  await db.$transaction(async (tx) => {
    for (const s of stock) {
      const got = Number(formData.get(`received:${s.variantId}`));
      if (got > 0) {
        await moveStock(tx, { distributorId: distributor.id, variantId: s.variantId, delta: got, transitDelta: -got, type: "RESTOCK_RECEIVED", actor, reference });
        received.push(`${got}×${s.variant.sizeKg}kg`);
      }
      const short = s.inTransit - got;
      if (short > 0) {
        await moveStock(tx, { distributorId: distributor.id, variantId: s.variantId, transitDelta: -short, type: "RESTOCK_SHORT", actor, reference, note: `${short} bag(s) not received` });
        shortages.push(`${short}×${s.variant.sizeKg}kg`);
      }
    }
  });
  if (shortages.length) await alertHq(`${distributor.name} received a delivery SHORT by ${shortages.join(", ")}${reference ? ` (ref ${reference})` : ""}.`);
  refresh();
  return {
    ok: true,
    message: `Received ${received.join(", ") || "nothing"}.${shortages.length ? ` Short: ${shortages.join(", ")}. HQ has been told.` : ""}`,
  };
}

/** Damage write-offs and count corrections wait for HQ approval before stock changes. */
export async function requestAdjustment(_prev: FormState, formData: FormData): Promise<FormState> {
  const { distributor, actor } = await requirePartner();
  const parsed = z.object({
    variantId: z.string().min(1, "Choose a bag size.").max(40),
    kind: z.enum(["DAMAGED", "COUNT_ADJUSTMENT"]),
    qty: z.coerce.number().int().min(0).max(100_000),
    note: z.string().trim().min(3, "Say briefly what happened.").max(300),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const f = parsed.data;
  const s = await db.distributorStock.findUnique({ where: { distributorId_variantId: { distributorId: distributor.id, variantId: f.variantId } }, include: { variant: true } });
  if (!s) return { ok: false, message: "Choose a bag size." };
  // DAMAGED: qty = bags damaged. COUNT_ADJUSTMENT: qty = bags actually counted on the shelf.
  const delta = f.kind === "DAMAGED" ? -f.qty : f.qty - s.onHand;
  if (delta === 0) return { ok: false, message: f.kind === "DAMAGED" ? "Enter how many bags were damaged." : "Your count matches the system. Nothing to change." };
  if (f.kind === "DAMAGED" && f.qty > s.onHand) return { ok: false, message: `You only have ${s.onHand} × ${s.variant.sizeKg}kg on hand.` };
  await db.stockMovement.create({
    data: { distributorId: distributor.id, variantId: f.variantId, delta, type: f.kind, status: "PENDING_APPROVAL", actor, note: f.note },
  });
  await alertHq(`${distributor.name} reported ${f.kind === "DAMAGED" ? `${f.qty} damaged` : `a count of ${f.qty}`} × ${s.variant.sizeKg}kg (change ${delta > 0 ? "+" : ""}${delta}). Approve in /ops/distributors.`);
  refresh();
  return { ok: true, message: "Sent to HQ for approval. Your stock will update once approved." };
}

// ─── Shop (walk-in) sales ───────────────────────────────────────────────────

export async function recordWalkInSale(_prev: FormState, formData: FormData): Promise<FormState> {
  const { distributor, actor } = await requirePartner();
  const method = String(formData.get("paymentMethod") ?? "");
  if (!["Cash", "Transfer", "POS"].includes(method)) return { ok: false, message: "Choose how the customer paid." };
  const variants = await db.variant.findMany();
  const lines: { variantId: string; sizeKg: number; qty: number; unitPriceKobo: number }[] = [];
  for (const v of variants) {
    const qty = Number(formData.get(`qty:${v.id}`) || 0);
    if (!qty) continue;
    if (!Number.isInteger(qty) || qty < 0 || qty > 10_000) return { ok: false, message: `${v.sizeKg}kg: enter a whole number of bags.` };
    const price = nairaToKobo(String(formData.get(`price:${v.id}`) ?? ""));
    if (price == null || Number.isNaN(price) || price <= 0) return { ok: false, message: `${v.sizeKg}kg: enter the price per bag.` };
    lines.push({ variantId: v.id, sizeKg: v.sizeKg, qty, unitPriceKobo: price });
  }
  if (!lines.length) return { ok: false, message: "Enter at least one bag sold." };
  const total = lines.reduce((n, l) => n + l.qty * l.unitPriceKobo, 0);
  try {
    await db.$transaction(async (tx) => {
      const sale = await tx.walkInSale.create({ data: { distributorId: distributor.id, lines, totalKobo: total, paymentMethod: method, createdBy: actor } });
      for (const l of lines) {
        const s = await tx.distributorStock.findUnique({ where: { distributorId_variantId: { distributorId: distributor.id, variantId: l.variantId } } });
        // Bags held for online orders that are awaiting payment can't be sold over the counter.
        if ((s?.onHand ?? 0) - (s?.held ?? 0) < l.qty) throw new Error(`STOCK:${l.sizeKg}:${(s?.onHand ?? 0) - (s?.held ?? 0)}`);
        await moveStock(tx, { distributorId: distributor.id, variantId: l.variantId, delta: -l.qty, type: "WALK_IN_SALE", actor, walkInSaleId: sale.id, note: `${method}, ${formatNaira(l.unitPriceKobo)} each` });
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("STOCK:")) {
      const [, size, free] = e.message.split(":");
      return { ok: false, message: `Only ${free} × ${size}kg free to sell (the rest is held for online orders awaiting payment).` };
    }
    throw e;
  }
  refresh();
  return { ok: true, message: `Recorded: ${lines.map((l) => `${l.qty} × ${l.sizeKg}kg`).join(", ")} for ${formatNaira(total)}.` };
}

// ─── Prices & delivery fees (owners) ────────────────────────────────────────

export async function savePrices(_prev: FormState, formData: FormData): Promise<FormState> {
  const { distributor, actor } = await requirePartner({ ownerOnly: true });
  const variants = await db.variant.findMany();
  const errors: string[] = [];
  for (const v of variants) {
    const retail = nairaToKobo(String(formData.get(`retail:${v.id}`) ?? ""));
    const wholesale = nairaToKobo(String(formData.get(`wholesale:${v.id}`) ?? ""));
    if (Number.isNaN(retail) || Number.isNaN(wholesale)) { errors.push(`${v.sizeKg}kg: enter prices as numbers.`); continue; }
    if (retail != null && !withinBand(retail, v.minRetailKobo, v.maxRetailKobo)) {
      errors.push(`${v.sizeKg}kg: price must be between ${v.minRetailKobo != null ? formatNaira(v.minRetailKobo) : "any"} and ${v.maxRetailKobo != null ? formatNaira(v.maxRetailKobo) : "any"}.`);
      continue;
    }
    if (wholesale != null && retail != null && wholesale > retail) { errors.push(`${v.sizeKg}kg: wholesale can't be above retail.`); continue; }
    await db.distributorPrice.upsert({
      where: { distributorId_variantId: { distributorId: distributor.id, variantId: v.id } },
      create: { distributorId: distributor.id, variantId: v.id, retailPriceKobo: retail, wholesalePriceKobo: wholesale },
      update: { retailPriceKobo: retail, wholesalePriceKobo: wholesale },
    });
  }
  await db.auditLog.create({ data: { actor, action: "partner.prices", entity: "Distributor", entityId: distributor.id } });
  refresh();
  if (errors.length) return { ok: false, message: `Saved the others. Please fix: ${errors.join(" ")}` };
  return { ok: true, message: "Prices saved. Customers in your areas see them now." };
}

export async function saveFees(_prev: FormState, formData: FormData): Promise<FormState> {
  const { distributor, actor } = await requirePartner({ ownerOnly: true });
  const zones = await db.deliveryZone.findMany({ where: { distributorId: distributor.id } });
  const num = (k: string) => { const v = nairaToKobo(String(formData.get(k) ?? "")); return v; };
  const int = (k: string) => { const s = String(formData.get(k) ?? "").trim(); return s === "" ? null : /^\d+$/.test(s) ? Number(s) : NaN; };
  const errors: string[] = [];
  for (const z of zones) {
    const data = {
      baseFeeKobo: num(`base:${z.id}`) ?? 0, perKgFeeKobo: num(`perKg:${z.id}`) ?? 0,
      minOrderKg: int(`minKg:${z.id}`), etaHours: int(`eta:${z.id}`),
      terms: String(formData.get(`terms:${z.id}`) ?? "").trim().slice(0, 300) || null,
    };
    if ([data.baseFeeKobo, data.perKgFeeKobo, data.minOrderKg, data.etaHours].some((x) => Number.isNaN(x) || (typeof x === "number" && x < 0))) {
      errors.push(`${z.name}: please enter valid numbers.`);
      continue;
    }
    await db.distributorZoneFee.upsert({
      where: { distributorId_zoneId: { distributorId: distributor.id, zoneId: z.id } },
      create: { distributorId: distributor.id, zoneId: z.id, ...data, minOrderKobo: null },
      update: data,
    });
  }
  await db.auditLog.create({ data: { actor, action: "partner.fees", entity: "Distributor", entityId: distributor.id } });
  updateTag(TAGS.zones);
  refresh();
  if (errors.length) return { ok: false, message: `Saved the others. Please fix: ${errors.join(" ")}` };
  return { ok: true, message: "Delivery fees saved." };
}

// ─── Staff (owners) ─────────────────────────────────────────────────────────

export async function addStaff(_prev: FormState, formData: FormData): Promise<FormState> {
  const { distributor, actor } = await requirePartner({ ownerOnly: true });
  const phone = normalizeNgPhone(String(formData.get("phone") ?? ""));
  const name = String(formData.get("name") ?? "").trim().slice(0, 80) || null;
  if (!phone) return { ok: false, message: "Enter a valid Nigerian mobile number." };
  const user = (await db.user.findUnique({ where: { phone }, include: { distributorMember: true } }))
    ?? (await db.user.create({ data: { phone, name, referralCode: makeReferralCode(name) }, include: { distributorMember: true } }));
  if (user.distributorMember) {
    return { ok: false, message: user.distributorMember.distributorId === distributor.id ? "Already on your team." : `${maskPhone(phone)} already works with another distributor.` };
  }
  await db.distributorMember.create({ data: { userId: user.id, distributorId: distributor.id, role: "STAFF" } });
  await db.auditLog.create({ data: { actor, action: "partner.staff_add", entity: "Distributor", entityId: distributor.id, after: { userId: user.id } } });
  await sendSms(phone, `${site.name}: ${distributor.name} added you to their team. Sign in with this number at ${site.url}/partner`);
  refresh();
  return { ok: true, message: `Added ${maskPhone(phone)}.` };
}

export async function removeStaff(formData: FormData) {
  const { distributor, actor } = await requirePartner({ ownerOnly: true });
  const userId = String(formData.get("userId") ?? "");
  const m = await db.distributorMember.findUnique({ where: { userId } });
  if (!m || m.distributorId !== distributor.id || m.role === "OWNER") return; // owners are changed by HQ
  await db.$transaction([
    db.distributorMember.delete({ where: { userId } }),
    db.session.deleteMany({ where: { userId } }),
    db.auditLog.create({ data: { actor, action: "partner.staff_remove", entity: "Distributor", entityId: distributor.id, after: { userId } } }),
  ]);
  refresh();
}

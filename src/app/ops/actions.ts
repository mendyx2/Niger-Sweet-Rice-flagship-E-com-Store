"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/catalogue";
import { nairaToKobo } from "@/lib/money";
import { checkOpsPassword, endOpsSession, requireOps, startOpsSession } from "@/lib/ops-auth";
import { CheckoutError, createPendingOrder, markOrderPaid } from "@/lib/orders";
import { sendSms } from "@/lib/sms";
import { site } from "@/lib/site";
import { HQ_ID, currentHqFees } from "@/lib/network";
import { moveStock } from "@/lib/stock";
import { changeOrderStatus, confirmTransferReceived, reportTransferNotReceived } from "@/lib/order-actions";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export type FormState = { ok: boolean; message: string } | null;

// ─── Login ──────────────────────────────────────────────────────────────────

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!(await rateLimit(`ops-login:${ip}`, 5, 15 * 60_000)).ok) {
    return { ok: false, message: "Too many attempts. Try again in 15 minutes." };
  }
  const password = String(formData.get("password") ?? "");
  if (!checkOpsPassword(password)) return { ok: false, message: "Incorrect password." };
  await startOpsSession();
  redirect("/ops/orders");
}

export async function logout() {
  await endOpsSession();
  redirect("/ops/login");
}

// ─── Prices & stock ─────────────────────────────────────────────────────────

const PRICE_FIELDS = ["retailPriceKobo", "wholesalePriceKobo", "compareAtPriceKobo", "minRetailKobo", "maxRetailKobo"] as const;
const MAX_PRICE_KOBO = 10_000_000_00; // ₦10m sanity cap per bag

export async function updatePrices(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  const [variants, hqStock, fees] = await Promise.all([
    db.variant.findMany(),
    db.distributorStock.findMany({ where: { distributorId: HQ_ID } }),
    currentHqFees(),
  ]);
  const stockBy = new Map(hqStock.map((x) => [x.variantId, x.onHand]));
  const errors: string[] = [];
  let changed = 0;

  await db.$transaction(async (tx) => {
    for (const v of variants) {
      const data: Record<string, number | null | boolean> = {};

      for (const field of PRICE_FIELDS) {
        const raw = formData.get(`${field}:${v.id}`);
        if (raw === null) continue;
        const kobo = nairaToKobo(String(raw));
        if (kobo !== null && (Number.isNaN(kobo) || kobo <= 0 || kobo > MAX_PRICE_KOBO)) {
          errors.push(`${v.sizeKg}kg: "${raw}" is not a valid price.`);
          continue;
        }
        if (kobo !== v[field]) {
          data[field] = kobo;
          await tx.priceChange.create({
            data: { variantId: v.id, field, oldValue: v[field], newValue: kobo, changedBy: actor },
          });
        }
      }

      // HQ's own shelf stock: recorded as a movement so the stock history stays complete.
      const stockRaw = formData.get(`stockQty:${v.id}`);
      if (stockRaw !== null) {
        const stock = z.coerce.number().int().min(0).max(1_000_000).safeParse(stockRaw);
        const current = stockBy.get(v.id) ?? 0;
        if (!stock.success) errors.push(`${v.sizeKg}kg: stock must be a whole number.`);
        else if (stock.data !== current) {
          await moveStock(tx, { distributorId: HQ_ID, variantId: v.id, delta: stock.data - current, type: "MANUAL_SET", actor, note: "Set on HQ prices page" });
          changed++;
        }
      }

      // HQ's fixed fee per bag sold by distributors. A change starts a new rate; history is kept.
      const feeRaw = formData.get(`hqFee:${v.id}`);
      if (feeRaw !== null) {
        const fee = nairaToKobo(String(feeRaw)) ?? 0;
        if (Number.isNaN(fee) || fee < 0 || fee > MAX_PRICE_KOBO) errors.push(`${v.sizeKg}kg: "${feeRaw}" is not a valid fee.`);
        else if (fee !== (fees.get(v.id) ?? 0)) {
          await tx.hqFeeRate.create({ data: { variantId: v.id, feeKobo: fee, setBy: actor } });
          await tx.auditLog.create({ data: { actor, action: "hqfee.change", entity: "Variant", entityId: v.id, before: { feeKobo: fees.get(v.id) ?? 0 }, after: { feeKobo: fee } } });
          changed++;
        }
      }
      const active = formData.get(`active:${v.id}`) === "on";
      if (active !== v.active) data.active = active;

      const compare = (data.compareAtPriceKobo ?? v.compareAtPriceKobo) as number | null;
      const retail = (data.retailPriceKobo ?? v.retailPriceKobo) as number | null;
      if (compare != null && retail != null && compare <= retail) {
        errors.push(`${v.sizeKg}kg: the "was" price must be higher than the retail price.`);
        delete data.compareAtPriceKobo;
      }
      const min = (data.minRetailKobo !== undefined ? data.minRetailKobo : v.minRetailKobo) as number | null;
      const max = (data.maxRetailKobo !== undefined ? data.maxRetailKobo : v.maxRetailKobo) as number | null;
      if (min != null && max != null && min > max) {
        errors.push(`${v.sizeKg}kg: the lowest distributor price can't be above the highest.`);
        delete data.minRetailKobo;
        delete data.maxRetailKobo;
      }

      if (Object.keys(data).length) {
        changed++;
        await tx.variant.update({ where: { id: v.id }, data });
        await tx.auditLog.create({
          data: { actor, action: "variant.update", entity: "Variant", entityId: v.id,
            before: { ...pick(v, Object.keys(data)) }, after: data },
        });
      }
    }
  });

  if (changed) updateTag(TAGS.catalogue);
  if (errors.length) return { ok: false, message: `Saved other changes. Please fix: ${errors.join(" ")}` };
  return { ok: true, message: changed ? `Saved. ${changed} bag size(s) updated. The shop shows the new prices now.` : "No changes." };
}

// ─── Delivery zones ─────────────────────────────────────────────────────────

const optionalNaira = (raw: FormDataEntryValue | null) => {
  if (raw === null) return undefined;
  const k = nairaToKobo(String(raw));
  return k === null ? null : k;
};
const optionalInt = (raw: FormDataEntryValue | null) => {
  if (raw === null) return undefined;
  const s = String(raw).trim();
  if (s === "") return null;
  return /^\d+$/.test(s) ? Number(s) : Number.NaN;
};

export async function updateZones(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  const zones = await db.deliveryZone.findMany();
  const errors: string[] = [];
  let changed = 0;

  await db.$transaction(async (tx) => {
    for (const zn of zones) {
      const next = {
        baseFeeKobo: optionalNaira(formData.get(`baseFee:${zn.id}`)) ?? 0,
        perKgFeeKobo: optionalNaira(formData.get(`perKgFee:${zn.id}`)) ?? 0,
        minOrderKg: optionalInt(formData.get(`minOrderKg:${zn.id}`)),
        minOrderKobo: optionalNaira(formData.get(`minOrder:${zn.id}`)),
        terms: (formData.get(`terms:${zn.id}`) as string | null)?.trim().slice(0, 300) || null,
        active: formData.get(`active:${zn.id}`) === "on",
      };
      if ([next.baseFeeKobo, next.perKgFeeKobo, next.minOrderKg, next.minOrderKobo].some((x) => Number.isNaN(x) || (typeof x === "number" && x < 0))) {
        errors.push(`${zn.name}: please enter valid numbers.`);
        continue;
      }
      const data: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(next)) {
        if (val !== undefined && val !== (zn as Record<string, unknown>)[k]) data[k] = val;
      }
      if (Object.keys(data).length) {
        changed++;
        await tx.deliveryZone.update({ where: { id: zn.id }, data });
        await tx.auditLog.create({
          data: { actor, action: "zone.update", entity: "DeliveryZone", entityId: zn.id,
            before: pick(zn, Object.keys(data)), after: data as object },
        });
      }
    }
  });

  if (changed) updateTag(TAGS.zones);
  if (errors.length) return { ok: false, message: `Saved other changes. Please fix: ${errors.join(" ")}` };
  return { ok: true, message: changed ? `Saved. ${changed} zone(s) updated.` : "No changes." };
}

function pick<T extends object>(obj: T, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, (obj as Record<string, unknown>)[k]])) as Record<string, never>;
}

// ─── Orders ─────────────────────────────────────────────────────────────────

const statusInput = z.object({
  orderId: z.string().max(40),
  status: z.enum(["PENDING_PAYMENT", "PAID", "PROCESSING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED_DELIVERY", "CANCELLED"]),
  riderName: z.string().trim().max(80).optional(),
  riderPhone: z.string().trim().max(20).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function updateOrderStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  const parsed = statusInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const r = await changeOrderStatus({ ...parsed.data, actor });
  if (r.ok) refresh();
  return r;
}

/** HQ can confirm or query a transfer on any order (e.g. HQ's own orders, or after a dispute). */
export async function opsConfirmTransfer(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  const orderId = String(formData.get("orderId") ?? "");
  const r = formData.get("decision") === "not_received" ? await reportTransferNotReceived(orderId, actor) : await confirmTransferReceived(orderId, actor);
  if (r.ok) refresh();
  return r;
}

// ─── Seller applications ────────────────────────────────────────────────────

export async function reviewSeller(formData: FormData) {
  const actor = await requireOps();
  const userId = String(formData.get("userId") ?? "");
  const decision = formData.get("decision") === "approve" ? "APPROVED" : "REJECTED";
  const profile = await db.sellerProfile.findUnique({ where: { userId }, include: { user: true } });
  if (!profile) return;
  await db.$transaction([
    db.sellerProfile.update({ where: { userId }, data: { status: decision } }),
    db.user.update({
      where: { id: userId },
      data: { roles: decision === "APPROVED" ? [...new Set([...profile.user.roles, "SELLER" as const])] : profile.user.roles.filter((r) => r !== "SELLER") },
    }),
    db.auditLog.create({ data: { actor, action: `seller.${decision.toLowerCase()}`, entity: "SellerProfile", entityId: userId } }),
  ]);
  await sendSms(
    profile.user.phone,
    decision === "APPROVED"
      ? `${site.name}: your seller account for ${profile.businessName} is approved. Wholesale prices now show when you sign in.`
      : `${site.name}: we couldn't approve your seller application for ${profile.businessName}. Please call us for details.`,
  );
  refresh();
}

// ─── Replacement claims ─────────────────────────────────────────────────────

export async function reviewClaim(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  const claimId = String(formData.get("claimId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;

  const claim = await db.returnClaim.findUnique({ where: { id: claimId }, include: { order: { include: { items: true, zone: true } } } });
  if (!claim || !["SUBMITTED", "UNDER_REVIEW"].includes(claim.status)) return { ok: false, message: "This claim has already been handled." };
  const order = claim.order;

  if (decision === "reject") {
    if (!note) return { ok: false, message: "Please add a short reason for the customer." };
    await db.$transaction([
      db.returnClaim.update({ where: { id: claim.id }, data: { status: "REJECTED", resolutionNote: note } }),
      db.auditLog.create({ data: { actor, action: "claim.rejected", entity: "ReturnClaim", entityId: claim.id, after: { note } } }),
    ]);
    await sendSms(order.contactPhone, `${site.name}: we couldn't approve your replacement request for order ${order.number}. ${note}`);
    refresh();
    return { ok: true, message: "Claim rejected and customer notified." };
  }

  // Approve: free replacement order (same address), stock taken now, collection of the damaged bag noted for the rider.
  const item = order.items.find((i) => i.id === claim.orderItemId);
  if (!item) return { ok: false, message: "Order item not found." };
  let replacement;
  try {
    replacement = await createPendingOrder({
      type: "REPLACEMENT",
      parentOrderId: order.id,
      // The bag comes from the same distributor's stock; HQ replaces it in their next delivery.
      distributorId: order.distributorId,
      paymentMethod: "NONE",
      userId: claim.userId,
      customerName: order.customerName,
      contactPhone: order.contactPhone,
      contactEmail: order.contactEmail,
      zoneId: order.zoneId,
      address: order.zone.kind === "PICKUP" ? null : (order.addressSnapshot as { street: string; landmark: string | null; zoneName: string }),
      note: `Replacement for ${order.number}. COLLECT ${claim.qty} damaged ${item.sizeKg}kg bag(s).`,
      couponId: null,
      referrerId: null,
      lines: [{ variantId: item.variantId, qty: claim.qty, unitPriceKobo: 0, sizeKg: item.sizeKg }],
      subtotalKobo: 0,
      discountKobo: 0,
      deliveryFeeKobo: 0,
      totalKobo: 0,
    });
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, message: `The seller doesn't have a ${item.sizeKg}kg bag in stock for the replacement. Send them stock first.` };
    throw e;
  }
  await markOrderPaid(replacement.number, { source: actor });
  await db.$transaction([
    db.returnClaim.update({ where: { id: claim.id }, data: { status: "REPLACEMENT_SCHEDULED", resolutionNote: note, replacementOrderId: replacement.id } }),
    db.auditLog.create({ data: { actor, action: "claim.approved", entity: "ReturnClaim", entityId: claim.id, after: { replacement: replacement.number } } }),
  ]);
  await sendSms(
    order.contactPhone,
    `${site.name}: your replacement for order ${order.number} is approved. We'll bring ${claim.qty} new ${item.sizeKg}kg bag(s) and collect the damaged one(s). Track: ${replacement.number}`,
  );
  refresh();
  return { ok: true, message: `Approved. Replacement order ${replacement.number} is in the Orders list.` };
}

export async function reviewAffiliate(formData: FormData) {
  const actor = await requireOps();
  const userId = String(formData.get("userId") ?? "");
  const decision = formData.get("decision") === "approve" ? "APPROVED" : "REJECTED";
  const profile = await db.affiliateProfile.findUnique({ where: { userId }, include: { user: true } });
  if (!profile) return;
  const roles = decision === "APPROVED"
    ? [...new Set([...profile.user.roles, "AFFILIATE" as const])]
    : profile.user.roles.filter((r) => r !== "AFFILIATE");
  await db.$transaction([
    db.affiliateProfile.update({ where: { userId }, data: { status: decision } }),
    db.user.update({ where: { id: userId }, data: { roles } }),
    db.auditLog.create({ data: { actor, action: `affiliate.${decision.toLowerCase()}`, entity: "AffiliateProfile", entityId: userId } }),
  ]);
  await sendSms(
    profile.user.phone,
    decision === "APPROVED"
      ? `${site.name}: you're now an affiliate! Your links are in My account. Share them to earn points.`
      : `${site.name}: we couldn't approve your affiliate application this time.`,
  );
  refresh();
}

// ─── Promotions & coupon codes ──────────────────────────────────────────────

const promoInput = z.object({
  title: z.string().trim().min(3, "Add a title.").max(80),
  body: z.string().trim().min(5, "Add a short description.").max(400),
  badge: z.string().trim().max(24).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  couponCode: z.string().trim().toUpperCase().max(20).regex(/^[A-Z0-9-]*$/, "Coupon codes can only use letters, numbers and dashes.").optional(),
  couponType: z.enum(["PERCENT", "FIXED"]).optional(),
  couponValue: z.string().optional(),
  couponMinOrder: z.string().optional(),
  couponMaxDiscount: z.string().optional(),
  couponMaxUses: z.string().optional(),
});

const lagosDate = (s: string | undefined, endOfDay = false) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T${endOfDay ? "23:59:59" : "00:00:00"}+01:00`); // Africa/Lagos is UTC+1, no DST
};

export async function createPromotion(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  const parsed = promoInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const f = parsed.data;
  const startsAt = lagosDate(f.startsAt) ?? new Date();
  const endsAt = lagosDate(f.endsAt, true);
  if (endsAt && endsAt <= startsAt) return { ok: false, message: "The end date must be after the start date." };

  let couponData: Prisma.CouponCreateInput | null = null;
  if (f.couponCode) {
    const value = f.couponType === "PERCENT" ? Number(f.couponValue) : nairaToKobo(f.couponValue ?? "");
    if (f.couponType === "PERCENT" && !(Number.isInteger(value) && value! >= 1 && value! <= 90)) {
      return { ok: false, message: "Percentage discount must be a whole number from 1 to 90." };
    }
    if (f.couponType !== "PERCENT" && !(value && value > 0)) return { ok: false, message: "Enter the naira amount off." };
    const minOrder = nairaToKobo(f.couponMinOrder ?? "") ?? 0;
    const maxDiscount = nairaToKobo(f.couponMaxDiscount ?? "");
    const maxUses = f.couponMaxUses ? Number(f.couponMaxUses) : 100_000;
    if ([minOrder, maxDiscount ?? 0].some(Number.isNaN) || !Number.isInteger(maxUses) || maxUses < 1) {
      return { ok: false, message: "Please check the coupon numbers." };
    }
    if (await db.coupon.findUnique({ where: { code: f.couponCode } })) return { ok: false, message: "That coupon code already exists." };
    couponData = {
      code: f.couponCode, type: f.couponType ?? "FIXED", value: value!, minOrderKobo: minOrder,
      maxDiscountKobo: maxDiscount, maxUses, source: "PROMO", startsAt, expiresAt: endsAt,
    };
  }

  await db.$transaction(async (tx) => {
    if (couponData) await tx.coupon.create({ data: couponData });
    const promo = await tx.promotion.create({
      data: { title: f.title, body: f.body, badge: f.badge || null, couponCode: f.couponCode || null, startsAt, endsAt },
    });
    await tx.auditLog.create({ data: { actor, action: "promotion.create", entity: "Promotion", entityId: promo.id, after: { ...f } } });
  });
  updateTag(TAGS.promotions);
  refresh();
  return { ok: true, message: "Promotion published." };
}

export async function togglePromotion(formData: FormData) {
  const actor = await requireOps();
  const id = String(formData.get("id") ?? "");
  const promo = await db.promotion.findUnique({ where: { id } });
  if (!promo) return;
  await db.$transaction(async (tx) => {
    await tx.promotion.update({ where: { id }, data: { active: !promo.active } });
    // Pausing a promotion also stops its coupon code from working.
    if (promo.couponCode) {
      await tx.coupon.updateMany({
        where: { code: promo.couponCode },
        data: promo.active ? { expiresAt: new Date() } : { expiresAt: promo.endsAt },
      });
    }
    await tx.auditLog.create({ data: { actor, action: promo.active ? "promotion.pause" : "promotion.resume", entity: "Promotion", entityId: id } });
  });
  updateTag(TAGS.promotions);
  refresh();
}

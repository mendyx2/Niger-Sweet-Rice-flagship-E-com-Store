"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/catalogue";
import { nairaToKobo } from "@/lib/money";
import { checkOpsPassword, endOpsSession, requireOps, startOpsSession } from "@/lib/ops-auth";
import { cancelUnpaidOrder } from "@/lib/orders";
import { notifyStatus } from "@/lib/notify";
import { NEXT_STATUSES } from "@/lib/status-text";
import { sendSms } from "@/lib/sms";
import { site } from "@/lib/site";

export type FormState = { ok: boolean; message: string } | null;

// ─── Login (basic brute-force protection; Redis-backed limiter in Phase 2) ──
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60_000;

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const now = Date.now();
  const a = attempts.get(ip);
  if (a && a.resetAt > now && a.count >= MAX_ATTEMPTS) {
    return { ok: false, message: "Too many attempts. Try again in 15 minutes." };
  }
  const password = String(formData.get("password") ?? "");
  if (!checkOpsPassword(password)) {
    attempts.set(ip, a && a.resetAt > now ? { ...a, count: a.count + 1 } : { count: 1, resetAt: now + WINDOW_MS });
    return { ok: false, message: "Incorrect password." };
  }
  attempts.delete(ip);
  await startOpsSession();
  redirect("/ops/orders");
}

export async function logout() {
  await endOpsSession();
  redirect("/ops/login");
}

// ─── Prices & stock ─────────────────────────────────────────────────────────

const PRICE_FIELDS = ["retailPriceKobo", "wholesalePriceKobo", "compareAtPriceKobo"] as const;
const MAX_PRICE_KOBO = 10_000_000_00; // ₦10m sanity cap per bag

export async function updatePrices(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOps();
  const variants = await db.variant.findMany();
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

      const stockRaw = formData.get(`stockQty:${v.id}`);
      if (stockRaw !== null) {
        const stock = z.coerce.number().int().min(0).max(1_000_000).safeParse(stockRaw);
        if (!stock.success) errors.push(`${v.sizeKg}kg: stock must be a whole number.`);
        else if (stock.data !== v.stockQty) data.stockQty = stock.data;
      }
      const active = formData.get(`active:${v.id}`) === "on";
      if (active !== v.active) data.active = active;

      const compare = (data.compareAtPriceKobo ?? v.compareAtPriceKobo) as number | null;
      const retail = (data.retailPriceKobo ?? v.retailPriceKobo) as number | null;
      if (compare != null && retail != null && compare <= retail) {
        errors.push(`${v.sizeKg}kg: the "was" price must be higher than the retail price.`);
        delete data.compareAtPriceKobo;
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
  const { orderId, status, riderName, riderPhone, note } = parsed.data;

  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { ok: false, message: "Order not found." };
  if (!NEXT_STATUSES[order.status].includes(status)) {
    return { ok: false, message: `Can't change from ${order.status} to ${status}.` };
  }

  if (status === "CANCELLED" && order.status === "PENDING_PAYMENT") {
    await cancelUnpaidOrder(order.id, note || "Cancelled by staff");
  } else {
    await db.$transaction(async (tx) => {
      const n = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status, ...(status === "DELIVERED" ? { deliveredAt: new Date() } : {}) },
      });
      if (n.count !== 1) throw new Error("Order changed in the meantime; reload and try again.");
      if (status === "CANCELLED") {
        // Paid order cancelled: put bags back in stock and void its points. Refund from the Paystack dashboard.
        for (const i of order.items) {
          await tx.$executeRaw`UPDATE "Variant" SET "stockQty" = "stockQty" + ${i.qty} WHERE "id" = ${i.variantId}`;
        }
        await tx.pointsTransaction.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "REVERSED" } });
      }
      if (status === "OUT_FOR_DELIVERY" && (riderName || riderPhone)) {
        await tx.shipment.upsert({
          where: { orderId: order.id },
          create: { orderId: order.id, riderName: riderName || null, riderPhone: riderPhone || null },
          update: { riderName: riderName || null, riderPhone: riderPhone || null },
        });
      }
      await tx.orderStatusEvent.create({ data: { orderId: order.id, status, note: note || null, actor } });
      await tx.auditLog.create({
        data: { actor, action: "order.status", entity: "Order", entityId: order.id, before: { status: order.status }, after: { status } },
      });
    });
  }
  const extra = status === "OUT_FOR_DELIVERY" && riderName ? `Rider: ${riderName}${riderPhone ? `, ${riderPhone}` : ""}.` : undefined;
  await notifyStatus(order, status, extra);
  refresh();
  return { ok: true, message: `${order.number} updated.` };
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

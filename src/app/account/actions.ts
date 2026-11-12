"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { destroySession, requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { newCouponCode, redeemPoints } from "@/lib/redeem";

export type FormState = { ok: boolean; message: string } | null;

const profile = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(80),
  email: z.union([z.literal(""), z.email("Please enter a valid email.").max(120)]),
});

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = profile.safeParse({ name: formData.get("name"), email: formData.get("email") ?? "" });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const email = parsed.data.email.toLowerCase() || null;
  if (email) {
    const taken = await db.user.findFirst({ where: { email, NOT: { id: user.id } } });
    if (taken) return { ok: false, message: "That email is already used by another account." };
  }
  await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name, email } });
  refresh();
  return { ok: true, message: "Saved." };
}

const seller = z.object({
  businessName: z.string().trim().min(2, "Please enter your business name.").max(120),
  cacNumber: z.string().trim().max(30).regex(/^[A-Za-z0-9 -]*$/, "CAC number can only contain letters and numbers.").optional(),
  address: z.string().trim().min(5, "Please enter your business address.").max(300),
  name: z.string().trim().min(2, "Please enter your name.").max(80),
});

export async function applyAsSeller(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/register?as=seller");
  const parsed = seller.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { name, ...data } = parsed.data;
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { name } }),
    db.sellerProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data, cacNumber: data.cacNumber || null },
      // Re-applying after a rejection puts the application back in the queue.
      update: { ...data, cacNumber: data.cacNumber || null, status: "PENDING" },
    }),
  ]);
  refresh();
  return { ok: true, message: "Application received. We'll review it and text you when it's approved." };
}

export async function redeem(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const points = Number(formData.get("points"));
  if (!Number.isInteger(points)) return { ok: false, message: "Invalid choice." };
  const r = await redeemPoints(user.id, points);
  if (!r.ok) return { ok: false, message: r.error === "NOT_ENOUGH_POINTS" ? "You don't have enough points for that yet." : "Invalid choice." };
  refresh();
  return { ok: true, message: `Your coupon ${r.code} is ready. Use it at checkout.` };
}

export async function applyAsAffiliate(): Promise<void> {
  const user = await requireUser();
  const existing = await db.affiliateProfile.findUnique({ where: { userId: user.id } });
  if (existing && existing.status !== "REJECTED") return;
  for (let i = 0; i < 5; i++) {
    const code = "A" + newCouponCode("X").slice(2, 8);
    try {
      await db.affiliateProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, code },
        update: { status: "PENDING" },
      });
      break;
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  refresh();
}

/**
 * Deletes the account's personal data (NDPA right to erasure). Order records are
 * kept, as the law requires for tax/accounting, but are no longer linked to a
 * login. Blocked while an order is still on its way.
 */
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    return { ok: false, message: "Type DELETE to confirm." };
  }
  const active = await db.order.count({
    where: { userId: user.id, status: { in: ["PENDING_PAYMENT", "PAID", "PROCESSING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "FAILED_DELIVERY"] } },
  });
  if (active) return { ok: false, message: "You have an order in progress. You can delete your account once it has been delivered." };

  const balance = (await db.pointsTransaction.aggregate({ where: { userId: user.id, status: "CONFIRMED" }, _sum: { delta: true } }))._sum.delta ?? 0;
  await db.$transaction([
    // Points ledger is append-only: zero the balance with an entry, and void pending points.
    ...(balance > 0
      ? [db.pointsTransaction.create({ data: { userId: user.id, delta: -balance, reason: "EXPIRY", status: "CONFIRMED", note: "Account deleted" } })]
      : []),
    db.pointsTransaction.updateMany({ where: { userId: user.id, status: "PENDING" }, data: { status: "REVERSED" } }),
    db.session.deleteMany({ where: { userId: user.id } }),
    db.address.deleteMany({ where: { userId: user.id } }),
    db.sellerProfile.deleteMany({ where: { userId: user.id } }),
    db.affiliateProfile.updateMany({ where: { userId: user.id }, data: { status: "REJECTED" } }),
    db.coupon.updateMany({ where: { userId: user.id, expiresAt: null }, data: { expiresAt: new Date() } }),
    db.coupon.updateMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, data: { expiresAt: new Date() } }),
    db.claimPhoto.deleteMany({ where: { claim: { userId: user.id } } }),
    db.user.update({
      where: { id: user.id },
      data: { phone: `deleted-${user.id}`, name: null, email: null, passwordHash: null, roles: ["BUYER"] },
    }),
    db.auditLog.create({ data: { actor: user.id, action: "account.deleted", entity: "User", entityId: user.id } }),
  ]);
  await destroySession();
  redirect("/?account=deleted");
}

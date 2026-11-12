"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
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

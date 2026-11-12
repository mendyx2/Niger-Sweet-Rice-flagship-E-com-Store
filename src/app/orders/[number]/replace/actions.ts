"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canClaimReplacement } from "@/lib/returns";
import { processUpload, UploadError } from "@/lib/images";
import { rateLimit } from "@/lib/rate-limit";

export type ClaimState = { ok: boolean; message: string } | null;

const schema = z.object({
  number: z.string().regex(/^NSR-[A-Z0-9]{6}$/),
  orderItemId: z.string().min(1, "Please choose the bag size.").max(40),
  qty: z.coerce.number().int().min(1).max(100),
  reason: z.enum(["TORN_BAG", "TAMPERED", "WATER_DAMAGED", "UNDERWEIGHT", "WRONG_SIZE"], { message: "Please choose what's wrong." }),
  description: z.string().trim().min(10, "Please describe the problem in a few words.").max(1000),
});

export async function submitClaim(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const user = await requireUser();
  if (!(await rateLimit(`claim:${user.id}`, 5, 60 * 60_000)).ok) return { ok: false, message: "Too many attempts. Please try again later." };

  const parsed = schema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const f = parsed.data;

  const order = await db.order.findUnique({ where: { number: f.number }, include: { items: true, returnClaims: true } });
  if (!order || order.userId !== user.id) return { ok: false, message: "Order not found." };
  if (order.type === "SAMPLE") return { ok: false, message: "Free samples aren't covered by the replacement policy." };
  if (order.status !== "DELIVERED" || !canClaimReplacement(order.deliveredAt)) {
    return { ok: false, message: "Replacement requests must be made within 48 hours of delivery." };
  }
  const item = order.items.find((i) => i.id === f.orderItemId);
  if (!item) return { ok: false, message: "Please choose the bag size." };
  const alreadyClaimed = order.returnClaims.filter((c) => c.orderItemId === item.id && c.status !== "REJECTED").reduce((n, c) => n + c.qty, 0);
  if (f.qty + alreadyClaimed > item.qty) return { ok: false, message: `You can claim at most ${item.qty - alreadyClaimed} more bag(s) of this size.` };

  const files = formData.getAll("photos").filter((v): v is File => v instanceof File && v.size > 0);
  if (files.length === 0) return { ok: false, message: "Please add at least one photo of the bag." };
  if (files.length > 5) return { ok: false, message: "Please add no more than 5 photos." };

  let photos;
  try {
    photos = await Promise.all(files.map(processUpload));
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, message: e.message };
    throw e;
  }

  await db.$transaction(async (tx) => {
    const claim = await tx.returnClaim.create({
      data: {
        orderId: order.id,
        orderItemId: item.id,
        qty: f.qty,
        userId: user.id,
        reason: f.reason,
        description: f.description,
        photos: { create: photos.map((p) => ({ mime: p.mime, data: new Uint8Array(p.data), width: p.width, height: p.height })) },
      },
    });
    await tx.auditLog.create({ data: { actor: user.id, action: "claim.submitted", entity: "ReturnClaim", entityId: claim.id } });
  });
  return { ok: true, message: "Thanks. We've received your request and will contact you within one working day." };
}

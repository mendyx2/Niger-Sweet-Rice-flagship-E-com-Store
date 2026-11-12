"use server";

import { db } from "@/lib/db";
import { normalizeNgPhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import type { OrderStatus } from "@prisma/client";

export type TrackResult =
  | { ok: false; error: string }
  | { ok: true; number: string; status: OrderStatus; isPickup: boolean; events: { status: OrderStatus; createdAt: Date }[]; items: string; riderName: string | null }
  | null;

/** Public tracking needs both the order number AND the phone on the order, and is rate-limited. */
export async function trackOrder(_prev: TrackResult, formData: FormData): Promise<TrackResult> {
  if (!(await rateLimit(`track:${await clientIp()}`, 20, 15 * 60_000)).ok) return { ok: false, error: "Too many lookups. Please try again later." };
  const number = String(formData.get("number") ?? "").trim().toUpperCase().replace(/^(?!NSR-)/, "NSR-");
  const phone = normalizeNgPhone(String(formData.get("phone") ?? ""));
  const notFound = { ok: false as const, error: "We couldn't find an order with that number and phone. Please check both." };
  if (!/^NSR-[A-Z0-9]{6}$/.test(number) || !phone) return notFound;

  const order = await db.order.findUnique({
    where: { number },
    include: { events: { orderBy: { createdAt: "asc" } }, items: true, zone: true, shipment: true },
  });
  if (!order || order.contactPhone !== phone) return notFound;
  return {
    ok: true,
    number: order.number,
    status: order.status,
    isPickup: order.zone.kind === "PICKUP",
    events: order.events.map((e) => ({ status: e.status, createdAt: e.createdAt })),
    items: order.items.map((i) => `${i.qty} × ${i.sizeKg}kg`).join(", "),
    riderName: order.status === "OUT_FOR_DELIVERY" ? order.shipment?.riderName ?? null : null,
  };
}

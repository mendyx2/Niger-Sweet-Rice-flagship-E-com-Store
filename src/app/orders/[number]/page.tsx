import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatNaira } from "@/lib/money";
import { formatNgPhone } from "@/lib/phone";
import { OrderTimeline } from "@/components/order-timeline";
import { StatusPill } from "@/components/order-status";
import { BagThumb } from "@/components/bag-thumb";
import { ClearCart, PayNowButton } from "./client";
import { canClaimReplacement } from "@/lib/returns";

const CLAIM_STATUS: Record<string, string> = {
  SUBMITTED: "received, we'll review it shortly",
  UNDER_REVIEW: "being reviewed",
  APPROVED: "approved",
  REPLACEMENT_SCHEDULED: "approved, replacement on the way",
  COMPLETED: "completed",
  REJECTED: "not approved",
};

const isWithinMinutes = (d: Date | null, mins: number) => !!d && Date.now() - d.getTime() < mins * 60_000;
const isFuture = (d: Date | null) => !!d && d.getTime() > Date.now();

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

export default function OrderPage({ params }: PageProps<"/orders/[number]">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <Suspense fallback={<p className="text-muted">Loading your order…</p>}>
        <Order params={params} />
      </Suspense>
    </div>
  );
}

async function Order({ params }: Pick<PageProps<"/orders/[number]">, "params">) {
  const { number } = await params;
  const user = await requireUser(`/orders/${number}`);
  const order = await db.order.findUnique({
    where: { number },
    include: { items: { include: { variant: true } }, events: { orderBy: { createdAt: "asc" } }, zone: true, shipment: true, returnClaims: true },
  });
  if (!order || order.userId !== user.id) notFound();

  const isPickup = order.zone.kind === "PICKUP";
  const addr = order.addressSnapshot as { street?: string; landmark?: string | null; zoneName?: string };
  const justPaid = order.status === "PAID" && isWithinMinutes(order.paidAt, 15);
  const canPay = order.status === "PENDING_PAYMENT" && isFuture(order.reservedUntil);

  return (
    <>
      {order.paidAt && <ClearCart />}
      {justPaid && (
        <div className="mb-8 rounded-3xl bg-brand p-6 sm:p-8 text-white">
          <p className="text-cta font-semibold">Thank you{order.customerName ? `, ${order.customerName.split(" ")[0]}` : ""}!</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1">Your order is confirmed</h1>
          <p className="mt-2 text-white/85">
            We&apos;ve sent an SMS to {formatNgPhone(order.contactPhone)}. We&apos;ll text you again when it&apos;s {isPickup ? "ready for pickup" : "on its way"}.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Order</p>
          <h2 className="font-display text-3xl font-bold">{order.number}</h2>
        </div>
        <StatusPill status={order.status} />
      </div>

      {canPay && (
        <div className="mt-6 rounded-2xl bg-cta/20 p-5">
          <p className="font-semibold">Payment not completed yet</p>
          <p className="text-sm mt-1">Your bags are held until {order.reservedUntil!.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" })}.</p>
          <PayNowButton number={order.number} />
        </div>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_320px] items-start">
        <section className="card p-6">
          <h3 className="font-display text-xl font-bold mb-5">Progress</h3>
          <OrderTimeline status={order.status} events={order.events} isPickup={isPickup} />
          {order.shipment?.riderName && order.status === "OUT_FOR_DELIVERY" && (
            <p className="mt-6 rounded-xl bg-brand-soft p-4 text-sm">
              Your rider: <strong>{order.shipment.riderName}</strong>
              {order.shipment.riderPhone && <> · <a className="underline" href={`tel:${order.shipment.riderPhone}`}>{order.shipment.riderPhone}</a></>}
            </p>
          )}
        </section>

        <aside className="space-y-6">
          <section className="card p-5">
            <h3 className="font-semibold">Items</h3>
            <ul className="mt-3 space-y-3">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 text-sm">
                  <BagThumb sizeKg={i.sizeKg} src={i.variant.imageUrl} />
                  <span className="flex-1">{i.qty} × {i.sizeKg}kg</span>
                  <span className="tabular-nums">{formatNaira(i.unitPriceKobo * i.qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{formatNaira(order.subtotalKobo)}</dd></div>
              {order.discountKobo > 0 && <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd className="text-promo tabular-nums">−{formatNaira(order.discountKobo)}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">{isPickup ? "Pickup" : "Delivery"}</dt><dd className="tabular-nums">{order.deliveryFeeKobo ? formatNaira(order.deliveryFeeKobo) : "Free"}</dd></div>
              <div className="flex justify-between font-bold text-base pt-1"><dt>Total</dt><dd className="tabular-nums">{formatNaira(order.totalKobo)}</dd></div>
            </dl>
          </section>
          <section className="card p-5 text-sm">
            <h3 className="font-semibold">{isPickup ? "Pickup" : "Delivery to"}</h3>
            {isPickup ? (
              <p className="mt-2 text-muted">Flagship store, {order.zone.name}</p>
            ) : (
              <p className="mt-2 text-muted">{addr.street}{addr.landmark ? ` (near ${addr.landmark})` : ""}, {addr.zoneName}</p>
            )}
            <p className="mt-2 text-muted">{order.customerName} · {formatNgPhone(order.contactPhone)}</p>
          </section>
          {order.returnClaims.length > 0 && (
            <section className="card p-5 text-sm">
              <h3 className="font-semibold">Replacement requests</h3>
              <ul className="mt-2 space-y-1">
                {order.returnClaims.map((c) => (
                  <li key={c.id}>
                    {c.qty} bag(s): <strong>{CLAIM_STATUS[c.status]}</strong>
                    {c.resolutionNote && <span className="block text-muted">{c.resolutionNote}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {order.status === "DELIVERED" && order.type !== "SAMPLE" && canClaimReplacement(order.deliveredAt) && (
            <Link href={`/orders/${order.number}/replace`} className="btn-outline w-full">Problem with a bag? Request a replacement</Link>
          )}
        </aside>
      </div>
    </>
  );
}

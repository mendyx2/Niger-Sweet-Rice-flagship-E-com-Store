"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useCart } from "@/lib/cart-store";
import { formatNaira } from "@/lib/money";
import { BagThumb } from "@/components/bag-thumb";
import { OrderSummary } from "@/components/order-summary";
import { ZoneSelect, type ZoneOption } from "@/components/zone-select";
import { getCartQuote, type CartQuoteResult } from "../cart/actions";
import { placeOrder, type CheckoutState } from "./actions";

export function CheckoutForm({
  zones, initialZoneId, initialCoupon, defaults,
}: {
  zones: ZoneOption[];
  initialZoneId: string;
  initialCoupon: string;
  defaults: { name: string; phone: string; email: string };
}) {
  const lines = useCart();
  const [zoneId, setZoneId] = useState(initialZoneId);
  const [data, setData] = useState<CartQuoteResult | null>(null);
  const [, startTransition] = useTransition();
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrder, null);

  const key = JSON.stringify([lines, zoneId]);
  useEffect(() => {
    if (!lines.length) return;
    startTransition(async () => setData(await getCartQuote({ lines, zoneId: zoneId || null, couponCode: initialCoupon || null })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Payment page (Paystack, or the local test page) opens once the order is created.
  useEffect(() => {
    if (state?.ok) window.location.assign(state.url);
  }, [state]);

  if (!lines.length) {
    return (
      <div className="mt-6 card p-10 text-center">
        <p className="text-lg font-semibold">Your cart is empty</p>
        <Link href="/shop" className="btn-cta mt-6">Shop rice</Link>
      </div>
    );
  }

  const zone = zones.find((z) => z.id === zoneId);
  const isPickup = zone?.kind === "PICKUP";
  const q = data?.quote;
  const redirecting = state?.ok === true;

  return (
    <form action={action} className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px] items-start">
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <input type="hidden" name="coupon" value={initialCoupon} />

      <div className="space-y-6">
        <fieldset className="card p-5 sm:p-6">
          <legend className="sr-only">Your details</legend>
          <h2 className="font-display text-xl font-bold">Your details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold">Full name</span>
              <input name="name" required defaultValue={defaults.name} autoComplete="name" className="field" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Phone for delivery</span>
              <input name="phone" type="tel" inputMode="tel" required defaultValue={defaults.phone} autoComplete="tel-national" className="field" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Email <span className="font-normal text-muted">(for receipt)</span></span>
              <input name="email" type="email" defaultValue={defaults.email} autoComplete="email" className="field" />
            </label>
          </div>
        </fieldset>

        <fieldset className="card p-5 sm:p-6">
          <legend className="sr-only">Delivery</legend>
          <h2 className="font-display text-xl font-bold">Delivery</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="zone" className="text-sm font-semibold">Area</label>
              <ZoneSelect zones={zones} value={zoneId} onChange={setZoneId} name="zoneId" required />
              {data?.zone?.terms && <p className="mt-2 text-xs text-muted">{data.zone.terms}</p>}
            </div>
            {isPickup ? (
              <p className="rounded-xl bg-brand-soft p-4 text-sm">
                You&apos;ll collect your order from our flagship store. We&apos;ll text you when it&apos;s ready.
              </p>
            ) : (
              <>
                <label className="block">
                  <span className="text-sm font-semibold">Street address</span>
                  <textarea name="street" rows={2} required autoComplete="street-address" placeholder="House number, street, estate" className="field" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold">Nearest landmark <span className="font-normal text-muted">(helps our rider)</span></span>
                  <input name="landmark" placeholder="e.g. opposite Wuse Market gate 2" className="field" />
                </label>
              </>
            )}
            <label className="block">
              <span className="text-sm font-semibold">Note <span className="font-normal text-muted">(optional)</span></span>
              <input name="note" maxLength={500} placeholder="e.g. call before arriving" className="field" />
            </label>
          </div>
        </fieldset>
      </div>

      <aside className="card p-5 sm:p-6 lg:sticky lg:top-24 space-y-5">
        <h2 className="font-display text-xl font-bold">Order summary</h2>
        <ul className="space-y-3">
          {data?.lines.map((l) => (
            <li key={l.variantId} className="flex items-center gap-3 text-sm">
              <BagThumb sizeKg={l.sizeKg} src={l.imageUrl} />
              <span className="flex-1">{l.qty} × {l.sizeKg}kg bag</span>
              <span className="font-medium tabular-nums">{l.unitPriceKobo != null ? formatNaira(l.unitPriceKobo * l.qty) : "—"}</span>
            </li>
          ))}
        </ul>
        <OrderSummary quote={q ?? null} subtotalKobo={0} zoneChosen={!!zoneId} isPickup={isPickup} />

        {zoneId && data && data.issues.length > 0 && (
          <ul role="alert" className="rounded-xl bg-promo-soft p-3 text-sm space-y-1">{data.issues.map((m) => <li key={m}>{m}</li>)}</ul>
        )}
        {state && !state.ok && (
          <ul role="alert" className="rounded-xl bg-promo-soft p-3 text-sm space-y-1">{state.errors.map((m) => <li key={m}>{m}</li>)}</ul>
        )}

        <button disabled={pending || redirecting || !q?.ok} className="btn-cta w-full text-lg">
          {pending ? "Placing order…" : redirecting ? "Opening payment…" : q ? `Pay ${formatNaira(q.totalKobo)}` : "Pay"}
        </button>
        <p className="text-xs text-muted text-center">
          You&apos;ll be taken to Paystack to pay by card, transfer or USSD. Your bags are held for 30 minutes while you pay.
        </p>
        <Link href="/cart" className="block text-center text-sm text-brand underline">Back to cart</Link>
      </aside>
    </form>
  );
}

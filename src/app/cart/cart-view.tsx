"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { cart, useCart } from "@/lib/cart-store";
import { formatNaira } from "@/lib/money";
import { BagThumb } from "@/components/bag-thumb";
import { MinusIcon, PlusIcon } from "@/components/icons";
import { OrderSummary } from "@/components/order-summary";
import { ZoneSelect, type ZoneOption } from "@/components/zone-select";
import { getCartQuote, type CartQuoteResult } from "./actions";

const ZONE_KEY = "nsr_zone";
const noopSubscribe = () => () => {};
const readZone = () => {
  try { return localStorage.getItem(ZONE_KEY) ?? ""; } catch { return ""; }
};

export function CartView({ zones }: { zones: ZoneOption[] }) {
  const lines = useCart();
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const storedZone = useSyncExternalStore(noopSubscribe, readZone, () => "");
  const [chosenZone, setChosenZone] = useState<string | null>(null);
  const zoneId = chosenZone ?? (zones.some((z) => z.id === storedZone) ? storedZone : "");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState("");
  const [data, setData] = useState<CartQuoteResult | null>(null);
  const [pending, startTransition] = useTransition();

  const key = JSON.stringify([lines, zoneId, coupon]);
  useEffect(() => {
    if (!lines.length) return;
    startTransition(async () => {
      const r = await getCartQuote({ lines, zoneId: zoneId || null, couponCode: coupon || null });
      setData(r);
      // Drop items that no longer exist in the catalogue.
      if (r) for (const l of lines) if (!r.lines.some((x) => x.variantId === l.variantId)) cart.remove(l.variantId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const chooseZone = (z: string) => {
    setChosenZone(z);
    try { localStorage.setItem(ZONE_KEY, z); } catch {}
  };

  const subtotal = useMemo(
    () => data?.lines.reduce((s, l) => s + (l.unitPriceKobo ?? 0) * l.qty, 0) ?? 0,
    [data],
  );

  if (!lines.length && hydrated) {
    return (
      <div className="mt-8 card p-10 text-center">
        <p className="text-lg font-semibold">Your cart is empty</p>
        <p className="text-muted mt-1">Pick a bag size to get started.</p>
        <Link href="/shop" className="btn-cta mt-6">Shop rice</Link>
      </div>
    );
  }

  const zone = zones.find((z) => z.id === zoneId);
  const blocking = data?.issues ?? [];
  const canCheckout = !!zoneId && data?.quote?.ok && !pending;
  const checkoutHref = `/checkout?zone=${encodeURIComponent(zoneId)}${coupon ? `&coupon=${encodeURIComponent(coupon)}` : ""}`;

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px] items-start">
      <ul className="card divide-y divide-border" aria-busy={pending}>
        {(data?.lines ?? []).map((l) => (
          <li key={l.variantId} className="flex gap-4 p-4">
            <BagThumb sizeKg={l.sizeKg} src={l.imageUrl} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between gap-3">
                <div>
                  <Link href={`/p/${l.productSlug}?size=${l.sizeKg}`} className="font-semibold hover:underline">
                    {l.productName}, {l.sizeKg}kg
                  </Link>
                  <p className="text-sm text-muted">{l.unitPriceKobo != null ? `${formatNaira(l.unitPriceKobo)} each` : "Not available"}</p>
                </div>
                <p className="font-semibold tabular-nums">{l.unitPriceKobo != null ? formatNaira(l.unitPriceKobo * l.qty) : "—"}</p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center rounded-full border border-border" role="group" aria-label={`Quantity for ${l.sizeKg}kg`}>
                  <button type="button" className="h-9 w-9 flex items-center justify-center rounded-l-full hover:bg-brand-soft" aria-label="Decrease"
                    onClick={() => cart.setQty(l.variantId, l.qty - 1)}><MinusIcon /></button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                  <button type="button" className="h-9 w-9 flex items-center justify-center rounded-r-full hover:bg-brand-soft disabled:opacity-40" aria-label="Increase"
                    disabled={l.qty >= Math.min(l.available, 100)} onClick={() => cart.setQty(l.variantId, l.qty + 1)}><PlusIcon /></button>
                </div>
                <button type="button" onClick={() => cart.remove(l.variantId)} className="text-sm text-muted underline hover:text-danger">Remove</button>
              </div>
              {!l.forSale && <p className="mt-2 text-sm text-danger">This size is no longer available. Please remove it.</p>}
              {l.forSale && l.qty > l.available && (
                <p className="mt-2 text-sm text-danger">{l.available === 0 ? "Out of stock." : `Only ${l.available} left.`}</p>
              )}
            </div>
          </li>
        ))}
        {!data && <li className="p-6 text-muted">Loading your cart…</li>}
      </ul>

      <aside className="card p-5 sm:p-6 lg:sticky lg:top-24 space-y-5">
        <div>
          <label htmlFor="zone" className="text-sm font-semibold">Delivery area</label>
          <ZoneSelect zones={zones} value={zoneId} onChange={chooseZone} />
          {data?.zone?.terms && <p className="mt-2 text-xs text-muted">{data.zone.terms}</p>}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); setCoupon(couponInput.trim().toUpperCase()); }}
        >
          <label htmlFor="coupon" className="sr-only">Coupon code</label>
          <input id="coupon" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="Coupon code"
            className="field mt-0 uppercase" autoCapitalize="characters" />
          <button className="rounded-xl border border-brand px-4 font-semibold text-brand hover:bg-brand-soft">Apply</button>
        </form>
        {data && data.myCoupons.length > 0 && !coupon && (
          <div className="-mt-3 flex flex-wrap gap-2 text-sm">
            <span className="text-muted">Your coupons:</span>
            {data.myCoupons.map((c) => (
              <button key={c.code} type="button" onClick={() => { setCouponInput(c.code); setCoupon(c.code); }}
                className="rounded-full border border-dashed border-brand px-2.5 py-0.5 font-semibold text-brand hover:bg-brand-soft">
                {c.label}
              </button>
            ))}
          </div>
        )}
        {coupon && data?.couponMessage && <p className="-mt-3 text-sm text-danger">{data.couponMessage}</p>}
        {coupon && data && !data.couponMessage && data.quote && data.quote.discountKobo > 0 && (
          <p className="-mt-3 text-sm text-success">Coupon {coupon} applied.</p>
        )}

        <OrderSummary quote={data?.quote ?? null} subtotalKobo={subtotal} zoneChosen={!!zoneId} isPickup={zone?.kind === "PICKUP"} />

        {zoneId && blocking.length > 0 && (
          <ul role="alert" className="rounded-xl bg-promo-soft p-3 text-sm space-y-1">
            {blocking.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}

        {canCheckout ? (
          <Link href={checkoutHref} className="btn-cta w-full text-lg">Checkout</Link>
        ) : (
          <button disabled className="btn-cta w-full text-lg">{zoneId ? (pending ? "Updating…" : "Checkout") : "Choose your area to continue"}</button>
        )}
        <p className="text-xs text-muted text-center">Secure payment by card, bank transfer or USSD via Paystack.</p>
      </aside>
    </div>
  );
}

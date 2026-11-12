"use client";

import { useEffect, useState, useTransition } from "react";
import { cart } from "@/lib/cart-store";
import { track } from "@/lib/analytics";
import { retryPayment } from "../../checkout/actions";

/** After payment: empty the cart and record the purchase once (deduplicated by order number). */
export function ClearCart({ number, totalKobo, items }: { number: string; totalKobo: number; items: { sku: string; sizeKg: number; priceKobo: number; qty: number }[] }) {
  useEffect(() => {
    cart.clear();
    try {
      const key = `nsr_purchase_${number}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {}
    track("purchase", {
      transactionId: number,
      valueKobo: totalKobo,
      items: items.map((i) => ({ item_id: i.sku, item_name: "Rice", item_variant: `${i.sizeKg}kg`, price: i.priceKobo / 100, quantity: i.qty })),
    });
  }, [number, totalKobo, items]);
  return null;
}

export function PayNowButton({ number }: { number: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          const r = await retryPayment(number);
          if (r?.ok) window.location.assign(r.url);
          else setError(r?.errors[0] ?? "Something went wrong.");
        })}
        className="btn-cta mt-4"
      >
        {pending ? "Opening payment…" : "Pay now"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { cart } from "@/lib/cart-store";
import { retryPayment } from "../../checkout/actions";

export function ClearCart() {
  useEffect(() => cart.clear(), []);
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

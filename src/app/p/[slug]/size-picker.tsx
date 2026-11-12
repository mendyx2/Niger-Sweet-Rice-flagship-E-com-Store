"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toItem, track } from "@/lib/analytics";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { CatalogueVariant } from "@/lib/catalogue";
import { cart } from "@/lib/cart-store";
import { Price, SaleBadge } from "@/components/price";
import { CheckIcon, MinusIcon, PlusIcon } from "@/components/icons";

export function SizePicker({
  variants,
  whatsapp,
  productName,
}: {
  variants: CatalogueVariant[];
  whatsapp: string;
  productName: string;
}) {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState<string | null>(null);

  const requested = Number(search.get("size"));
  const selected = variants.find((v) => v.sizeKg === requested) ?? variants[0];

  useEffect(() => {
    if (selected?.retailPriceKobo == null) return;
    track("view_item", {
      valueKobo: selected.retailPriceKobo,
      items: [toItem({ sku: selected.sku, sizeKg: selected.sizeKg, priceKobo: selected.retailPriceKobo }, productName)],
    });
  }, [selected?.id, selected?.retailPriceKobo, selected?.sku, selected?.sizeKg, productName]);

  if (!selected) return null;

  const priced = selected.retailPriceKobo != null;
  const maxQty = Math.min(selected.available, 100);
  const canBuy = priced && selected.available > 0;
  const waText = encodeURIComponent(`Hello, I'd like to order ${productName} ${selected.sizeKg}kg × ${qty}.`);

  const choose = (sizeKg: number) => {
    setQty(1);
    setAdded(null);
    router.replace(`${pathname}?size=${sizeKg}`, { scroll: false });
  };

  const addToCart = () => {
    cart.add(selected.id, qty);
    track("add_to_cart", {
      valueKobo: selected.retailPriceKobo! * qty,
      items: [toItem({ sku: selected.sku, sizeKg: selected.sizeKg, priceKobo: selected.retailPriceKobo!, qty }, productName)],
    });
    setAdded(`${qty} × ${selected.sizeKg}kg`);
  };

  return (
    <div className="mt-8">
      <fieldset>
        <legend className="text-sm font-semibold">Bag size</legend>
        <div className="mt-3 grid grid-cols-4 gap-2" role="radiogroup">
          {variants.map((v) => {
            const active = v.id === selected.id;
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => choose(v.sizeKg)}
                className={`rounded-xl border-2 px-2 py-3 text-center transition-colors ${
                  active ? "border-brand bg-brand-soft text-brand" : "border-border bg-surface hover:border-brand/50"
                }`}
              >
                <span className="block font-bold">{v.sizeKg}kg</span>
                {v.retailPriceKobo != null && v.available === 0 && <span className="block text-[11px] text-danger">Sold out</span>}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <Price kobo={selected.retailPriceKobo} compareAt={selected.compareAtPriceKobo} sizeKg={selected.sizeKg} size="lg" />
          <SaleBadge kobo={selected.retailPriceKobo} compareAt={selected.compareAtPriceKobo} />
        </div>
        {priced && (
          <p className={`mt-2 text-sm font-medium ${selected.available > 0 ? "text-success" : "text-danger"}`}>
            {selected.available > 10 ? "In stock" : selected.available > 0 ? `Only ${selected.available} left` : "Out of stock"}
          </p>
        )}

        {canBuy ? (
          <div className="mt-5 flex gap-3">
            <div className="flex items-center rounded-full border border-border" role="group" aria-label="Quantity">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}
                className="h-12 w-11 flex items-center justify-center rounded-l-full hover:bg-brand-soft disabled:opacity-40" aria-label="Decrease quantity">
                <MinusIcon />
              </button>
              <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty}
                className="h-12 w-11 flex items-center justify-center rounded-r-full hover:bg-brand-soft disabled:opacity-40" aria-label="Increase quantity">
                <PlusIcon />
              </button>
            </div>
            <button type="button" onClick={addToCart} className="btn-cta flex-1 text-base">
              Add to cart
            </button>
          </div>
        ) : (
          <p className="mt-5 rounded-xl bg-background p-3 text-sm text-muted">
            {priced ? "This size is out of stock right now." : "This size isn't on sale online yet."} You can still order on WhatsApp.
          </p>
        )}

        {added && (
          <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-soft p-3 text-sm">
            <span className="flex items-center gap-2 font-medium text-brand"><CheckIcon /> Added {added} to your cart</span>
            <Link href="/cart" className="font-semibold text-brand underline underline-offset-2">View cart &amp; checkout →</Link>
          </div>
        )}

        {whatsapp && (
          <a href={`https://wa.me/${whatsapp}?text=${waText}`} className="mt-4 block text-center text-sm font-semibold text-brand hover:underline"
            rel="noopener noreferrer" target="_blank">
            Prefer to chat? Order on WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

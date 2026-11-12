"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { CatalogueVariant } from "@/lib/catalogue";
import { Price } from "@/components/price";

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
  const requested = Number(search.get("size"));
  const selected = variants.find((v) => v.sizeKg === requested) ?? variants[0];
  if (!selected) return null;

  const canBuy = selected.retailPriceKobo != null && selected.available > 0;
  const waText = encodeURIComponent(`Hello, I'd like to order ${productName} ${selected.sizeKg}kg.`);

  return (
    <div className="mt-8">
      <fieldset>
        <legend className="text-sm font-semibold">Choose a bag size</legend>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {variants.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={v.id === selected.id}
              onClick={() => router.replace(`${pathname}?size=${v.sizeKg}`, { scroll: false })}
              className={`rounded-xl border px-2 py-3 font-semibold transition-colors ${
                v.id === selected.id ? "border-brand bg-brand text-white" : "border-border bg-surface hover:border-brand"
              }`}
            >
              {v.sizeKg}kg
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <p className="text-2xl">
          <Price kobo={selected.retailPriceKobo} compareAt={selected.compareAtPriceKobo} sizeKg={selected.sizeKg} />
        </p>
        {selected.retailPriceKobo != null && (
          <p className={`mt-1 text-sm ${selected.available > 0 ? "text-brand" : "text-danger"}`}>
            {selected.available > 0 ? "In stock" : "Out of stock"}
          </p>
        )}
        <button
          type="button"
          disabled
          className="mt-4 w-full rounded-full bg-brand py-3 font-semibold text-white disabled:opacity-50"
          title="Online checkout is coming soon"
        >
          {canBuy ? "Online checkout coming soon" : "Not available yet"}
        </button>
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}?text=${waText}`}
            className="mt-3 block w-full rounded-full border border-brand py-3 text-center font-semibold text-brand hover:bg-brand-soft"
            rel="noopener noreferrer"
            target="_blank"
          >
            Order on WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

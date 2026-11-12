import type { Metadata } from "next";
import Link from "next/link";
import { getProducts } from "@/lib/catalogue";
import { Price } from "@/components/price";

export const metadata: Metadata = {
  title: "Shop Rice in Abuja: 50kg, 25kg, 5kg & 1kg Bags",
  description: "Buy Niger Sweet Rice online in Abuja. Compare 50kg, 25kg, 5kg and 1kg bag prices and price per kg.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage() {
  const products = await getProducts();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Shop</h1>
      <p className="text-muted mt-1">All bag sizes, with the price per kg so you can compare.</p>
      {products.map((p) => (
        <section key={p.id} className="mt-8">
          <h2 className="font-display text-2xl font-bold text-brand">
            <Link href={`/p/${p.slug}`} className="hover:underline">{p.name}</Link>
          </h2>
          <ul className="mt-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
            {p.variants.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/p/${p.slug}?size=${v.sizeKg}`}
                  className="block rounded-2xl border border-border bg-surface p-5 hover:border-brand transition-colors"
                >
                  <p className="font-display text-3xl font-bold">{v.sizeKg}kg</p>
                  <p className="text-sm mt-1">
                    <Price kobo={v.retailPriceKobo} compareAt={v.compareAtPriceKobo} sizeKg={v.sizeKg} />
                  </p>
                  {v.retailPriceKobo != null && v.available === 0 && (
                    <p className="text-xs text-danger mt-2">Out of stock</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

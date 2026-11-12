import type { Metadata } from "next";
import Link from "next/link";
import { getProducts } from "@/lib/catalogue";
import { site } from "@/lib/site";
import { Price, SaleBadge } from "@/components/price";
import { BagImage } from "@/components/bag-image";

export const metadata: Metadata = {
  title: "Shop Rice in Abuja: 50kg, 25kg, 5kg & 1kg Bags",
  description: `Buy ${site.name} online in Abuja. Compare 50kg, 25kg, 5kg and 1kg bag prices and price per kg.`,
  alternates: { canonical: "/shop" },
};

export default async function ShopPage() {
  const products = await getProducts();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-4xl font-bold">Shop</h1>
      <p className="text-muted mt-2">Every bag size, with the price per kg so you can compare.</p>
      {products.map((p) => (
        <section key={p.id} className="mt-8">
          <h2 className="font-semibold text-lg">{p.name}</h2>
          <ul className="mt-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
            {p.variants.map((v) => (
              <li key={v.id}>
                <Link href={`/p/${p.slug}?size=${v.sizeKg}`} className="card group block p-3 hover:border-brand hover:shadow-md transition">
                  <div className="relative">
                    <BagImage src={v.imageUrl} className="aspect-square bg-background" sizes="(min-width: 1024px) 260px, 45vw" />
                    <span className="absolute right-2 top-2"><SaleBadge kobo={v.retailPriceKobo} compareAt={v.compareAtPriceKobo} /></span>
                  </div>
                  <div className="px-2 pb-2 pt-3">
                    <p className="font-display text-2xl font-bold group-hover:text-brand">{v.sizeKg}kg bag</p>
                    <p className="mt-1 text-sm"><Price kobo={v.retailPriceKobo} compareAt={v.compareAtPriceKobo} sizeKg={v.sizeKg} /></p>
                    {v.retailPriceKobo != null && (
                      <p className={`mt-2 text-xs font-medium ${v.available > 0 ? "text-success" : "text-danger"}`}>
                        {v.available > 0 ? "In stock" : "Out of stock"}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

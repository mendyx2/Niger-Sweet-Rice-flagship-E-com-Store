import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProduct, getProducts } from "@/lib/catalogue";
import { site } from "@/lib/site";
import { JsonLd } from "@/components/json-ld";
import { SizePicker } from "./size-picker";

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return {};
  const sizes = p.variants.map((v) => `${v.sizeKg}kg`).join(", ");
  return {
    title: `${p.name}: ${sizes} Bags, Abuja Delivery`,
    description: `${p.description.slice(0, 120)} Order online in Abuja.`,
    alternates: { canonical: `/p/${p.slug}` },
  };
}

export default async function ProductPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();

  const priced = p.variants.filter((v) => v.retailPriceKobo != null);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 grid gap-10 md:grid-cols-2">
      {priced.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Product",
            name: p.name,
            description: p.description,
            brand: { "@type": "Brand", name: "Niger Sweet Rice" },
            offers: priced.map((v) => ({
              "@type": "Offer",
              sku: v.sku,
              name: `${p.name} ${v.sizeKg}kg`,
              price: (v.retailPriceKobo! / 100).toFixed(2),
              priceCurrency: "NGN",
              availability: v.available > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              url: `${site.url}/p/${p.slug}?size=${v.sizeKg}`,
              areaServed: "Abuja",
            })),
          }}
        />
      )}
      <div className="aspect-square rounded-3xl bg-brand-soft flex items-center justify-center">
        <span className="font-display text-brand text-5xl font-bold text-center px-6">{p.name}</span>
      </div>
      <div>
        <h1 className="font-display text-4xl font-bold">{p.name}</h1>
        <p className="mt-4 text-muted">{p.description}</p>
        <Suspense fallback={<div className="mt-8 h-48 rounded-2xl bg-surface border border-border" />}>
          <SizePicker variants={p.variants} whatsapp={site.whatsapp} productName={p.name} />
        </Suspense>
      </div>
    </div>
  );
}

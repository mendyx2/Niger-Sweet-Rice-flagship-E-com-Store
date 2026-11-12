import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProduct, getProducts } from "@/lib/catalogue";
import { site } from "@/lib/site";
import { JsonLd } from "@/components/json-ld";
import { SizePicker } from "./size-picker";
import { BagImage } from "@/components/bag-image";
import { ShieldIcon, StoreIcon, TruckIcon } from "@/components/icons";
import Link from "next/link";

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

export default function ProductPage({ params }: PageProps<"/p/[slug]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <Product params={params} />
    </Suspense>
  );
}

function ProductSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12 grid gap-8 md:gap-12 md:grid-cols-2" aria-busy="true">
      <div className="aspect-square rounded-3xl bg-surface border border-border animate-pulse" />
      <div className="space-y-4">
        <div className="h-12 w-3/4 rounded-xl bg-border/60 animate-pulse" />
        <div className="h-24 rounded-xl bg-border/40 animate-pulse" />
        <div className="h-72 rounded-2xl bg-surface border border-border" />
      </div>
    </div>
  );
}

async function Product({ params }: Pick<PageProps<"/p/[slug]">, "params">) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();

  const priced = p.variants.filter((v) => v.retailPriceKobo != null);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12 grid gap-8 md:gap-12 md:grid-cols-2">
      {priced.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Product",
            name: p.name,
            description: p.description,
            brand: { "@type": "Brand", name: site.name },
            image: `${site.url}${site.productImage}`,
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
      <div className="md:sticky md:top-24 self-start">
        <BagImage priority className="aspect-square border border-border" />
      </div>
      <div>
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href="/shop" className="hover:underline">Shop</Link> <span aria-hidden="true">/</span> {p.name}
        </nav>
        <h1 className="font-display text-4xl sm:text-5xl font-bold mt-2">{p.name}</h1>
        <p className="mt-4 text-muted text-lg leading-relaxed">{p.description}</p>
        <Suspense fallback={<div className="mt-8 h-72 card" />}>
          <SizePicker variants={p.variants} whatsapp={site.whatsapp} productName={p.name} />
        </Suspense>
        <ul className="mt-8 space-y-3 text-sm">
          <li className="flex gap-3"><TruckIcon className="h-5 w-5 text-brand shrink-0" /> Delivery across Abuja within 24 hours; nearby towns have a minimum order.</li>
          <li className="flex gap-3"><StoreIcon className="h-5 w-5 text-brand shrink-0" /> Free pickup at our Abuja flagship store.</li>
          <li className="flex gap-3"><ShieldIcon className="h-5 w-5 text-brand shrink-0" /> Damaged or underweight bag? <Link href="/returns-policy" className="underline">We replace it.</Link></li>
        </ul>
      </div>
    </div>
  );
}

import Link from "next/link";
import { getProducts } from "@/lib/catalogue";
import { site } from "@/lib/site";
import { Price, SaleBadge } from "@/components/price";
import { JsonLd } from "@/components/json-ld";
import { BagImage } from "@/components/bag-image";
import { GiftIcon, ShieldIcon, StoreIcon, TruckIcon } from "@/components/icons";

const benefits = [
  { Icon: TruckIcon, title: "Abuja delivery", text: "Across Abuja, plus Suleja, Mararaba, Nyanya & more" },
  { Icon: StoreIcon, title: "Free store pickup", text: "Collect from our flagship store" },
  { Icon: ShieldIcon, title: "Bag replacement", text: "Damaged bag? We replace it within 48h of delivery" },
  { Icon: GiftIcon, title: "Purchase points", text: "Every ₦100 earns a point towards a discount" },
];

export default async function Home() {
  const products = await getProducts();
  const rice = products[0];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "GroceryStore",
          name: site.legalName,
          url: site.url,
          image: `${site.url}${site.productImage}`,
          telephone: site.phone || undefined,
          openingHours: site.hours,
          areaServed: ["Abuja", "Suleja", "Mararaba", "Nyanya", "Karu", "Kuje", "Bwari", "Madalla"],
          address: {
            "@type": "PostalAddress",
            streetAddress: site.street || undefined,
            addressLocality: site.area ? `${site.area}, ${site.city}` : site.city,
            addressRegion: site.region,
            addressCountry: site.country,
          },
          ...(site.lat && site.lng ? { geo: { "@type": "GeoCoordinates", latitude: site.lat, longitude: site.lng } } : {}),
        }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand text-white">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-20 grid gap-10 md:grid-cols-[1.1fr_0.9fr] items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-cta" aria-hidden="true" /> Abuja flagship store
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold mt-4 leading-[1.05]">
              Sweet, stone-free rice, <span className="text-cta">delivered</span> to your door.
            </h1>
            <p className="mt-5 text-white/85 text-lg max-w-lg">
              Superior quality, triple-sorted parboiled rice in 50kg, 25kg, 5kg and 1kg bags. Order online and get it
              delivered in Abuja, or pick it up free.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className="btn-cta text-lg px-8">Shop now</Link>
              <Link href="/delivery" className="inline-flex items-center rounded-full border border-white/40 px-6 py-3 font-semibold hover:bg-white/10">
                See delivery areas
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute inset-6 rounded-full bg-cta/25 blur-3xl" aria-hidden="true" />
            <BagImage priority className="relative aspect-square shadow-2xl" sizes="(min-width: 768px) 380px, 80vw" />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section aria-label="Why shop with us" className="border-b border-border bg-surface">
        <ul className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
          {benefits.map(({ Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Icon />
              </span>
              <span>
                <span className="block font-semibold text-sm">{title}</span>
                <span className="block text-xs text-muted mt-0.5">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Sizes */}
      {rice && (
        <section className="mx-auto max-w-6xl px-4 pt-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-bold">Pick your bag size</h2>
              <p className="text-muted mt-1">Bigger bags cost less per kg.</p>
            </div>
            <Link href="/shop" className="hidden sm:inline text-brand font-semibold hover:underline">View all →</Link>
          </div>
          <ul className="mt-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
            {rice.variants.map((v) => (
              <li key={v.id}>
                <Link href={`/p/${rice.slug}?size=${v.sizeKg}`} className="card group block p-3 hover:border-brand hover:shadow-md transition">
                  <div className="relative">
                    <BagImage className="aspect-square bg-background" sizes="(min-width: 1024px) 260px, 45vw" />
                    <span className="absolute right-2 top-2"><SaleBadge kobo={v.retailPriceKobo} compareAt={v.compareAtPriceKobo} /></span>
                  </div>
                  <div className="px-2 pb-2 pt-3">
                    <p className="font-display text-2xl font-bold group-hover:text-brand">{v.sizeKg}kg bag</p>
                    <p className="mt-1 text-sm"><Price kobo={v.retailPriceKobo} compareAt={v.compareAtPriceKobo} sizeKg={v.sizeKg} /></p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Rewards + sample */}
      <section className="mx-auto max-w-6xl px-4 pt-14 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-brand-soft p-8">
          <h2 className="font-display text-2xl font-bold text-brand">Shop more, save more</h2>
          <p className="mt-2 text-foreground/80">
            Earn a point for every ₦100 you spend. Turn 500 points into a ₦2,000 discount coupon, and invite friends to
            earn even faster.
          </p>
          <Link href="/promotions" className="mt-5 btn-primary">How points work</Link>
        </div>
        <div className="rounded-3xl bg-promo-soft p-8">
          <span className="inline-block rounded-full bg-promo px-3 py-1 text-xs font-bold text-white">Try it first</span>
          <h2 className="font-display text-2xl font-bold mt-3">Free 1kg sample</h2>
          <p className="mt-2 text-foreground/80">
            Not sure yet? Taste it first. The rice is free; you only pay delivery, or pick it up at the store.
          </p>
          <Link href="/promotions#sample" className="mt-5 btn-outline">Learn more</Link>
        </div>
      </section>
    </>
  );
}

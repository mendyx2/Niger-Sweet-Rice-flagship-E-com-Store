import Link from "next/link";
import { getProducts } from "@/lib/catalogue";
import { site } from "@/lib/site";
import { Price } from "@/components/price";
import { JsonLd } from "@/components/json-ld";

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
          ...(site.lat && site.lng
            ? { geo: { "@type": "GeoCoordinates", latitude: site.lat, longitude: site.lng } }
            : {}),
        }}
      />

      <section className="bg-brand text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24 grid gap-8 sm:grid-cols-2 items-center">
          <div>
            <p className="uppercase tracking-widest text-xs text-accent-soft">Abuja flagship store</p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold mt-3 leading-tight">
              Sweet, stone-free rice, delivered across Abuja.
            </h1>
            <p className="mt-4 text-white/85 max-w-md">
              Buy Niger Sweet Rice in 50kg, 25kg, 5kg and 1kg bags. Delivered to your door in Abuja and nearby
              towns, or picked up at our flagship store.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className="rounded-full bg-accent px-6 py-3 font-semibold text-foreground hover:brightness-105">
                Shop bag sizes
              </Link>
              <Link href="/delivery" className="rounded-full border border-white/40 px-6 py-3 font-semibold hover:bg-white/10">
                Delivery areas
              </Link>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-3" aria-label="Bag sizes">
            {rice?.variants.map((v) => (
              <li key={v.id} className="rounded-2xl bg-white/10 p-5">
                <p className="font-display text-3xl font-bold">{v.sizeKg}kg</p>
                <p className="mt-1 text-sm text-white/85"><Price kobo={v.retailPriceKobo} onDark /></p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 grid gap-6 sm:grid-cols-3">
        {[
          ["Every bag size", "From a 1kg trial pack to a 50kg family or business bag, at a clear price per kg."],
          ["Bag replacement promise", "Torn, damaged or underweight bag? Report it within 48 hours of delivery and we replace it, collection included."],
          ["Earn purchase points", "Every order earns points you can turn into discount coupons. Invite friends to earn more."],
        ].map(([title, text]) => (
          <div key={title} className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="font-display text-xl font-bold text-brand">{title}</h2>
            <p className="mt-2 text-muted">{text}</p>
          </div>
        ))}
      </section>
    </>
  );
}

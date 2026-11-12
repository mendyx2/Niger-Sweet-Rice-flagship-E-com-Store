import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProducts, getZones } from "@/lib/catalogue";
import { deliveryFeeKobo } from "@/lib/pricing";
import { formatNaira } from "@/lib/money";
import { site } from "@/lib/site";
import { JsonLd } from "@/components/json-ld";
import { BagImage } from "@/components/bag-image";
import { Price } from "@/components/price";

/** One page per delivery area, e.g. /delivery/gwarinpa, for "rice delivery in <area>" searches. */
export async function generateStaticParams() {
  const zones = await getZones();
  return zones.filter((z) => z.kind !== "PICKUP").map((z) => ({ area: z.slug }));
}

async function findZone(slug: string) {
  const zones = await getZones();
  const zone = zones.find((z) => z.slug === slug && z.kind !== "PICKUP");
  return { zone, zones };
}

export async function generateMetadata({ params }: PageProps<"/delivery/[area]">): Promise<Metadata> {
  const { area } = await params;
  const { zone } = await findZone(area);
  if (!zone) return {};
  const where = zone.kind === "ABUJA" ? `${zone.name}, Abuja` : zone.name;
  return {
    title: `Rice Delivery in ${where}: 50kg, 25kg & 5kg Bags`,
    description: `Order ${site.name} for delivery to ${where}. Delivery from ${formatNaira(zone.baseFeeKobo)}${zone.etaHours ? `, usually within ${zone.etaHours} hours` : ""}. Pay online by card, transfer or USSD.`,
    alternates: { canonical: `/delivery/${zone.slug}` },
  };
}

export default function AreaPage({ params }: PageProps<"/delivery/[area]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-12 h-96" />}>
      <Area params={params} />
    </Suspense>
  );
}

async function Area({ params }: Pick<PageProps<"/delivery/[area]">, "params">) {
  const { area } = await params;
  const [{ zone, zones }, products] = await Promise.all([findZone(area), getProducts()]);
  if (!zone) notFound();

  const rice = products[0];
  const where = zone.kind === "ABUJA" ? `${zone.name}, Abuja` : zone.name;
  const sizes = rice?.variants.filter((v) => v.retailPriceKobo != null && !v.isSampleSize) ?? [];
  const others = zones.filter((z) => z.kind === zone.kind && z.id !== zone.id).slice(0, 12);
  const moq = [zone.minOrderKg && `${zone.minOrderKg}kg`, zone.minOrderKobo && formatNaira(zone.minOrderKobo)].filter(Boolean).join(" or ");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "GroceryStore",
              name: site.legalName,
              url: site.url,
              telephone: site.phone || undefined,
              areaServed: { "@type": "Place", name: where },
              address: { "@type": "PostalAddress", addressLocality: site.area ? `${site.area}, Abuja` : "Abuja", addressRegion: "FCT", addressCountry: "NG" },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Delivery", item: `${site.url}/delivery` },
                { "@type": "ListItem", position: 2, name: zone.name, item: `${site.url}/delivery/${zone.slug}` },
              ],
            },
          ],
        }}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/delivery" className="hover:underline">Delivery areas</Link> <span aria-hidden="true">/</span> {zone.name}
      </nav>
      <h1 className="font-display text-4xl sm:text-5xl font-bold mt-2">Rice delivery in {where}</h1>
      <p className="mt-4 text-lg text-muted max-w-2xl">
        Get {site.name} delivered to your home, shop or office in {zone.name}. Order online, pay by card, transfer or USSD, and track your order by SMS.
      </p>

      <dl className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="card p-5"><dt className="text-sm text-muted">Delivery fee</dt><dd className="mt-1 text-xl font-bold">{formatNaira(zone.baseFeeKobo)} + {formatNaira(zone.perKgFeeKobo)}/kg</dd></div>
        <div className="card p-5"><dt className="text-sm text-muted">Usually arrives</dt><dd className="mt-1 text-xl font-bold">{zone.etaHours ? `Within ${zone.etaHours} hours` : "Ask us"}</dd></div>
        <div className="card p-5"><dt className="text-sm text-muted">Minimum order</dt><dd className="mt-1 text-xl font-bold">{moq || "None"}</dd></div>
      </dl>
      {zone.terms && <p className="mt-3 text-sm text-muted">{zone.terms}</p>}

      {sizes.length > 0 && rice && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Prices delivered to {zone.name}</h2>
          <div className="mt-4 overflow-x-auto card">
            <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-3 sm:[&_th]:px-3">
              <thead className="text-left text-muted">
                <tr><th className="p-3">Bag</th><th className="p-3">Rice</th><th className="p-3">Delivery</th><th className="p-3">You pay</th><th className="hidden p-3 sm:table-cell"><span className="sr-only">Buy</span></th></tr>
              </thead>
              <tbody>
                {sizes.map((v) => {
                  const fee = deliveryFeeKobo(zone, v.sizeKg);
                  const meetsMoq = !zone.minOrderKg || v.sizeKg >= zone.minOrderKg;
                  return (
                    <tr key={v.id} className="border-t border-border">
                      <td className="p-3">
                        <Link href={`/p/${rice.slug}?size=${v.sizeKg}`} className="flex items-center gap-3 font-bold text-brand hover:underline sm:text-foreground">
                          <BagImage src={v.imageUrl} className="hidden h-14 w-14 rounded-xl border border-border shrink-0 sm:block" sizes="56px" />
                          {v.sizeKg}kg
                        </Link>
                      </td>
                      <td className="p-3"><Price kobo={v.retailPriceKobo} compareAt={v.compareAtPriceKobo} /></td>
                      <td className="p-3 tabular-nums">{meetsMoq ? formatNaira(fee) : <span className="text-muted">Below minimum</span>}</td>
                      <td className="p-3 font-semibold tabular-nums">{meetsMoq ? formatNaira(v.retailPriceKobo! + fee) : "—"}</td>
                      <td className="hidden p-3 sm:table-cell"><Link href={`/p/${rice.slug}?size=${v.sizeKg}`} className="font-semibold text-brand underline">Buy</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">Delivery shown for one bag. Buying several? The base fee is charged once and the per-kg charge applies to the total weight.</p>
        </section>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/shop" className="btn-cta">Shop now</Link>
        <Link href="/samples" className="btn-outline">Try a free 1kg sample</Link>
      </div>

      {others.length > 0 && (
        <section className="mt-14">
          <h2 className="font-semibold text-lg">We also deliver to</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {others.map((z) => (
              <li key={z.id}><Link href={`/delivery/${z.slug}`} className="inline-block rounded-full border border-border bg-surface px-3 py-1.5 text-sm hover:border-brand">{z.name}</Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

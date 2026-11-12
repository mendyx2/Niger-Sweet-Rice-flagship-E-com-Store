import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";
import { getActivePromotions } from "@/lib/catalogue";
import { PromoCode } from "./promo-code";

export const metadata: Metadata = {
  title: "Rice Promotions & Discount Offers in Abuja",
  description: `Current ${site.name} promotions, discount offers and coupon codes for Abuja shoppers.`,
  alternates: { canonical: "/promotions" },
};

const endLabel = (d: Date | null) =>
  d ? `Ends ${d.toLocaleDateString("en-NG", { day: "numeric", month: "long", timeZone: "Africa/Lagos" })}` : null;

export default async function PromotionsPage() {
  const promos = await getActivePromotions();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-4xl font-bold">Promotions</h1>
      <p className="text-muted mt-2">Discount offers, seasonal deals and ways to save.</p>

      {promos.length > 0 && (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {promos.map((p) => (
            <li key={p.id} className="relative overflow-hidden rounded-3xl bg-brand p-6 text-white">
              {p.badge && <span className="inline-block rounded-full bg-promo px-3 py-1 text-xs font-bold">{p.badge}</span>}
              <h2 className="font-display text-2xl font-bold mt-3">{p.title}</h2>
              <p className="mt-2 text-white/85">{p.body}</p>
              {p.couponCode && <PromoCode code={p.couponCode} />}
              {endLabel(p.endsAt) && <p className="mt-3 text-xs text-white/70">{endLabel(p.endsAt)}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="rounded-3xl bg-brand-soft p-6">
          <h2 className="font-display text-xl font-bold text-brand">Earn purchase points</h2>
          <p className="mt-2">
            Every ₦100 you spend earns a point. Collect 500 points for a ₦2,000 coupon, 1,000 for ₦5,000, or 2,500 for ₦15,000.
          </p>
          <Link href="/account" className="mt-4 inline-block font-semibold text-brand underline">See your points</Link>
        </section>
        <section id="sample" className="rounded-3xl bg-promo-soft p-6 scroll-mt-24">
          <h2 className="font-display text-xl font-bold">Try a free 1kg sample</h2>
          <p className="mt-2">The rice is free. You only pay delivery, or pick it up free at the flagship store. One per household.</p>
          <Link href="/samples" className="mt-4 inline-block font-semibold underline">Request a sample</Link>
        </section>
      </div>

      {promos.length === 0 && (
        <p className="mt-10 text-muted">No other offers are running right now. <Link className="underline" href="/shop">Browse all bag sizes</Link>.</p>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Rice Promotions & Discount Offers in Abuja",
  description: "Current Niger Sweet Rice promotions, discount offers and coupon codes for Abuja shoppers.",
  alternates: { canonical: "/promotions" },
};

export default function PromotionsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Promotions</h1>
      <p className="text-muted mt-2">Discount offers, bundles and seasonal deals.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl bg-accent-soft p-6">
          <h2 className="font-display text-xl font-bold">Earn purchase points</h2>
          <p className="mt-2">
            Every ₦100 you spend earns you a point. Collect 500 points for a ₦2,000 coupon, 1,000 for ₦5,000, or
            2,500 for ₦15,000.
          </p>
        </section>
        <section className="rounded-2xl bg-brand-soft p-6">
          <h2 className="font-display text-xl font-bold">Try a free 1kg sample</h2>
          <p className="mt-2">
            The rice is free. You only pay delivery, or pick it up free at the flagship store. One per household.
          </p>
        </section>
      </div>

      <p className="mt-10 text-muted">
        No other promotions are running right now. <Link className="underline" href="/shop">Browse all bag sizes</Link>.
      </p>
    </div>
  );
}

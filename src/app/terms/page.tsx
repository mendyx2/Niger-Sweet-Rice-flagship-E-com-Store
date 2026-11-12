import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of sale", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 space-y-6 leading-relaxed">
      <h1 className="font-display text-4xl font-bold">Terms of sale</h1>
      <p className="text-muted">The basics of buying from {site.name}. Please have these reviewed by a lawyer before launch.</p>
      <ul className="list-disc pl-6 space-y-2">
        <li><strong>Prices</strong> are in naira and include the rice only; delivery is shown separately before you pay.</li>
        <li><strong>Payment</strong> is taken online through Paystack when you place your order. Pay-on-delivery isn&apos;t available.</li>
        <li><strong>Stock</strong> is held for 30 minutes while you pay. Unpaid orders are cancelled automatically after that.</li>
        <li><strong>Nearby towns</strong> outside Abuja have a minimum order, shown at checkout.</li>
        <li><strong>Replacements:</strong> see our <Link href="/returns-policy" className="underline">bag replacement policy</Link>. We replace bags; we don&apos;t give cash refunds, except where an order can&apos;t be fulfilled.</li>
        <li><strong>Points and coupons</strong> have no cash value, can&apos;t be transferred, and expire (points after 12 months, coupons on the date shown). Points from an order are reversed if it is cancelled.</li>
        <li><strong>Free samples</strong> are limited to one per person and address. Delivery fees for samples are non-refundable once dispatched.</li>
        <li><strong>Affiliates and referrals</strong> can&apos;t earn on their own orders. We may withdraw rewards earned through abuse.</li>
      </ul>
    </article>
  );
}

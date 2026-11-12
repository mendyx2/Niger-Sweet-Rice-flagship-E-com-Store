import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Bag Replacement Policy",
  description: `Damaged, torn or underweight bag? Report it within 48 hours of delivery and ${site.name} will replace it, collection included.`,
  alternates: { canonical: "/returns-policy" },
};

export default function ReturnsPolicyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 space-y-6 leading-relaxed">
      <h1 className="font-display text-3xl font-bold">Bag replacement policy</h1>
      <p>
        We replace bags; we don&apos;t give cash refunds. If something is wrong with your bag, we will collect it
        and bring you a new one <strong>at no cost to you</strong>.
      </p>
      <section>
        <h2 className="font-display text-xl font-bold text-brand">What we replace</h2>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>Torn or burst bags</li>
          <li>Bags that look tampered with or have a broken seal</li>
          <li>Water-damaged or wet rice</li>
          <li>Underweight bags</li>
          <li>The wrong bag size</li>
        </ul>
      </section>
      <section>
        <h2 className="font-display text-xl font-bold text-brand">How to claim</h2>
        <ol className="list-decimal pl-6 mt-2 space-y-1">
          <li>Report it within <strong>48 hours of delivery</strong> (or pickup).</li>
          <li>Send clear photos of the bag and the problem, plus your order number.</li>
          <li>We review your claim, usually within one working day.</li>
          <li>Once approved, we collect the damaged bag and deliver the replacement. We pay for both trips.</li>
        </ol>
        <p className="mt-3 text-muted">
          Soon you&apos;ll be able to submit claims from your account. Until then, contact us
          {site.phone ? ` on ${site.phone}` : ""}{site.whatsapp ? " or on WhatsApp" : ""}.
        </p>
      </section>
      <section>
        <h2 className="font-display text-xl font-bold text-brand">Good to know</h2>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>Purchase points on an order are held until any replacement claim is settled.</li>
          <li>Free samples are not covered by this policy.</li>
          <li>Bags opened and partly used are only replaced for weight or quality problems we can verify.</li>
        </ul>
      </section>
    </article>
  );
}

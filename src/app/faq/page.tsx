import type { Metadata } from "next";
import { FAQ } from "@/lib/faq";
import { site } from "@/lib/site";
import { JsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
  title: "Questions about buying rice online in Abuja",
  description: `Delivery fees, bag sizes, payment, bag replacement, free samples and purchase points: answers about ordering ${site.name} in Abuja.`,
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />
      <h1 className="font-display text-4xl font-bold">Frequently asked questions</h1>
      <div className="mt-8 divide-y divide-border card">
        {FAQ.map((f) => (
          <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold">
              {f.q}
              <span aria-hidden="true" className="text-brand text-xl transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-muted leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

/** Plain-language privacy notice written to the Nigeria Data Protection Act 2023. Have it reviewed by a lawyer before launch. */
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 space-y-6 leading-relaxed">
      <h1 className="font-display text-4xl font-bold">Privacy policy</h1>
      <p className="text-muted">How {site.name} collects and uses your personal data, in line with the Nigeria Data Protection Act 2023.</p>
      <section>
        <h2 className="font-display text-xl font-bold text-brand">What we collect</h2>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li><strong>Account:</strong> your phone number, and your name and email if you add them.</li>
          <li><strong>Orders:</strong> delivery address, landmark, items, amounts and order history.</li>
          <li><strong>Payments:</strong> handled by Paystack. We never see or store your card details.</li>
          <li><strong>Replacement requests:</strong> the photos you upload. We remove location data from them.</li>
          <li><strong>Website use:</strong> only if you accept analytics cookies (Google Analytics, Meta Pixel).</li>
        </ul>
      </section>
      <section>
        <h2 className="font-display text-xl font-bold text-brand">Why we use it</h2>
        <p className="mt-2">To deliver your orders, send order updates and login codes by SMS, run purchase points and referrals, handle bag replacements, prevent fraud and, if you agree, measure and improve our marketing.</p>
      </section>
      <section>
        <h2 className="font-display text-xl font-bold text-brand">Who we share it with</h2>
        <p className="mt-2">Only the services we need to run the store: Paystack (payments), our SMS provider (codes and updates), delivery partners (name, phone and address for your delivery) and, with your consent, Google and Meta (analytics). We don&apos;t sell your data.</p>
      </section>
      <section>
        <h2 className="font-display text-xl font-bold text-brand">Your rights</h2>
        <p className="mt-2">
          You can see and correct your details in <Link href="/account" className="underline">My account</Link>, delete your account there at any time,
          withdraw cookie consent using &ldquo;Cookie settings&rdquo; at the bottom of any page, and contact us about anything else. We keep order and payment
          records for as long as the law requires for tax and accounting, even after an account is deleted.
        </p>
      </section>
      <section>
        <h2 className="font-display text-xl font-bold text-brand">Contact</h2>
        <p className="mt-2">{site.legalName}{site.area ? `, ${site.area}` : ""}, Abuja{site.phone ? ` · ${site.phone}` : ""}</p>
      </section>
    </article>
  );
}

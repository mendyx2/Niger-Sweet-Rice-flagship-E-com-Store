import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getZones } from "@/lib/catalogue";
import { formatNgPhone } from "@/lib/phone";
import { site } from "@/lib/site";
import { BagImage } from "@/components/bag-image";
import { OtpForm } from "../login/otp-form";
import { SampleForm } from "./sample-form";

export const metadata: Metadata = {
  title: "Free 1kg Rice Sample in Abuja",
  description: `Taste ${site.name} before you buy. The 1kg sample is free; pay only delivery in Abuja, or pick it up free at our flagship store.`,
  alternates: { canonical: "/samples" },
};

export default function SamplesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12 grid gap-10 md:grid-cols-[0.9fr_1.1fr] items-start">
      <div>
        <span className="inline-block rounded-full bg-promo px-3 py-1 text-xs font-bold text-white">Try it first</span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold mt-3">Free 1kg sample</h1>
        <p className="mt-4 text-lg text-muted">
          Cook it, taste it, then decide. The rice is on us. You only pay the delivery fee, or collect it free at our flagship store.
        </p>
        <ul className="mt-6 space-y-2 text-sm">
          <li>• One free sample per person and per address</li>
          <li>• Pickup, or delivery anywhere in Abuja</li>
          <li>• Not available for nearby-town delivery</li>
        </ul>
        <BagImage src="/images/sweet-rice-1kg.jpg" sizeKg={1} className="mt-8 aspect-square max-w-sm border border-border" />
      </div>
      <div className="card p-6 sm:p-8">
        <Suspense fallback={<div className="h-64" />}>
          <SampleContent />
        </Suspense>
      </div>
    </div>
  );
}

async function SampleContent() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <h2 className="font-display text-2xl font-bold">First, confirm your phone</h2>
        <p className="mt-2 text-muted">We&apos;ll text you a code. This keeps samples to one per person.</p>
        <div className="mt-6"><OtpForm next="/samples" /></div>
      </>
    );
  }
  const claim = await db.sampleClaim.findUnique({ where: { userId: user.id } });
  if (claim) {
    const order = await db.order.findUnique({ where: { id: claim.orderId } });
    return (
      <>
        <h2 className="font-display text-2xl font-bold">You&apos;ve requested your sample</h2>
        <p className="mt-2 text-muted">Enjoy it! When you&apos;re ready for more, every bag size is in the shop.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {order && <Link href={`/orders/${order.number}`} className="btn-primary">View sample order</Link>}
          <Link href="/shop" className="btn-outline">Shop bags</Link>
        </div>
      </>
    );
  }
  const zones = (await getZones()).filter((z) => z.kind !== "NEARBY_TOWN");
  return (
    <>
      <h2 className="font-display text-2xl font-bold">Where should we send it?</h2>
      <SampleForm
        zones={zones.map((z) => ({ id: z.id, name: z.name, kind: z.kind }))}
        defaults={{ name: user.name ?? "", phone: formatNgPhone(user.phone) }}
      />
    </>
  );
}

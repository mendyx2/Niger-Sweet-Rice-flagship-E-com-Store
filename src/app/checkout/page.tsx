import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getZones } from "@/lib/catalogue";
import { formatNgPhone } from "@/lib/phone";
import { OtpForm } from "../login/otp-form";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <h1 className="font-display text-4xl font-bold">Checkout</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Checkout searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Checkout({ searchParams }: Pick<PageProps<"/checkout">, "searchParams">) {
  const sp = await searchParams;
  const zoneId = typeof sp.zone === "string" ? sp.zone : "";
  const coupon = typeof sp.coupon === "string" ? sp.coupon : "";
  const [user, zones] = await Promise.all([getCurrentUser(), getZones()]);

  if (!user) {
    const next = `/checkout?${new URLSearchParams({ zone: zoneId, ...(coupon ? { coupon } : {}) })}`;
    return (
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="card p-6 sm:p-8 max-w-xl">
          <p className="text-sm font-semibold text-brand">Step 1 of 2</p>
          <h2 className="font-display text-2xl font-bold mt-1">Confirm your phone number</h2>
          <p className="mt-2 text-muted">
            We&apos;ll text you a code. Your number is used for delivery updates, and your purchase points are saved to it.
          </p>
          <div className="mt-6"><OtpForm next={next} /></div>
        </section>
      </div>
    );
  }

  return (
    <CheckoutForm
      zones={zones.map((z) => ({ id: z.id, name: z.name, kind: z.kind }))}
      initialZoneId={zones.some((z) => z.id === zoneId) ? zoneId : ""}
      initialCoupon={coupon}
      defaults={{ name: user.name ?? "", phone: formatNgPhone(user.phone), email: user.email ?? "" }}
    />
  );
}

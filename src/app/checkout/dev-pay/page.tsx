import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isDevPaymentMode } from "@/lib/paystack";
import { orderNumberFromReference } from "@/lib/paystack-signature";
import { markOrderPaid, cancelUnpaidOrder } from "@/lib/orders";
import { requireUser } from "@/lib/auth";
import { formatNaira } from "@/lib/money";

/** LOCAL DEVELOPMENT ONLY: stands in for Paystack when no secret key is configured. */
export default function DevPayPage({ searchParams }: PageProps<"/checkout/dev-pay">) {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Suspense fallback={null}><DevPay searchParams={searchParams} /></Suspense>
    </div>
  );
}

async function DevPay({ searchParams }: Pick<PageProps<"/checkout/dev-pay">, "searchParams">) {
  if (!isDevPaymentMode()) notFound();
  const user = await requireUser();
  const reference = String((await searchParams).reference ?? "");
  const number = orderNumberFromReference(reference);
  const order = number ? await db.order.findUnique({ where: { number } }) : null;
  if (!order || order.userId !== user.id) notFound();

  async function pay() {
    "use server";
    if (!isDevPaymentMode() || !order) return;
    await markOrderPaid(order.number, { reference, amountKobo: order.totalKobo, currency: "NGN", source: "dev-pay" });
    redirect(`/orders/${order.number}`);
  }
  async function cancel() {
    "use server";
    if (!isDevPaymentMode() || !order) return;
    await cancelUnpaidOrder(order.id, "Cancelled on test payment page");
    redirect("/cart");
  }

  return (
    <div className="card p-8 text-center">
      <p className="inline-block rounded-full bg-promo px-3 py-1 text-xs font-bold text-white">Test mode: no real payment</p>
      <h1 className="font-display text-2xl font-bold mt-4">Simulated payment</h1>
      <p className="mt-2 text-muted">Paystack isn&apos;t connected yet. Use this page to test the order flow.</p>
      <p className="mt-6 text-3xl font-bold">{formatNaira(order.totalKobo)}</p>
      <p className="text-sm text-muted">Order {order.number}</p>
      <form action={pay} className="mt-6"><button className="btn-cta w-full">Simulate successful payment</button></form>
      <form action={cancel} className="mt-3"><button className="text-sm text-muted underline">Cancel payment</button></form>
    </div>
  );
}

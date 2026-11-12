import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canClaimReplacement } from "@/lib/returns";
import { ClaimForm } from "./claim-form";

export const metadata: Metadata = { title: "Request a replacement bag", robots: { index: false } };

export default function ReplacePage({ params }: PageProps<"/orders/[number]/replace">) {
  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Replace params={params} />
      </Suspense>
    </div>
  );
}

async function Replace({ params }: Pick<PageProps<"/orders/[number]/replace">, "params">) {
  const { number } = await params;
  const user = await requireUser(`/orders/${number}/replace`);
  const order = await db.order.findUnique({ where: { number }, include: { items: true } });
  if (!order || order.userId !== user.id) notFound();

  const open = order.status === "DELIVERED" && order.type !== "SAMPLE" && canClaimReplacement(order.deliveredAt);
  return (
    <>
      <Link href={`/orders/${order.number}`} className="text-sm text-brand underline">← Order {order.number}</Link>
      <h1 className="font-display text-3xl sm:text-4xl font-bold mt-3">Request a replacement bag</h1>
      <p className="mt-2 text-muted">
        Torn, wet, tampered, underweight or the wrong size? Show us with a photo and we&apos;ll collect it and bring you a new bag, free.
      </p>
      <div className="mt-6 card p-5 sm:p-6">
        {open ? (
          <ClaimForm number={order.number} items={order.items.map((i) => ({ id: i.id, label: `${i.sizeKg}kg bag`, qty: i.qty }))} />
        ) : (
          <p className="text-muted">
            Replacement requests can be made within 48 hours of delivery. For anything else, please call or WhatsApp us.
          </p>
        )}
      </div>
    </>
  );
}

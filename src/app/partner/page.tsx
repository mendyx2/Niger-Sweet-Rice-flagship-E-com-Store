import Link from "next/link";
import { Suspense } from "react";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { NEXT_STATUSES } from "@/lib/status-text";
import { OrderCard } from "@/components/order-card";
import { PaymentControls } from "@/components/payment-controls";
import { StatusForm } from "@/components/status-form";
import { STATUS_LABEL } from "@/components/order-status";
import { PartnerNav } from "./partner-nav";
import { partnerPayment, partnerStatus } from "./actions";

const FILTERS: { key: string; label: string; statuses: OrderStatus[]; leadsTo?: OrderStatus[] }[] = [
  { key: "pay", label: "Confirm payment", statuses: ["PENDING_PAYMENT"], leadsTo: ["PAID", "CANCELLED"] },
  { key: "todo", label: "To deliver", statuses: ["PAID", "PROCESSING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "FAILED_DELIVERY"], leadsTo: ["DELIVERED", "CANCELLED"] },
  { key: "done", label: "Delivered", statuses: ["DELIVERED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
];

const recentlyChanged = () => new Date(Date.now() - 10 * 60_000);

export default function PartnerOrdersPage({ searchParams }: PageProps<"/partner">) {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Orders searchParams={searchParams} /></Suspense>;
}

async function Orders({ searchParams }: Pick<PageProps<"/partner">, "searchParams">) {
  const { distributor, member } = await requirePartner();
  const sp = await searchParams;
  const counts = await db.order.groupBy({ by: ["status"], where: { distributorId: distributor.id }, _count: true });
  const count = (s: OrderStatus[]) => counts.filter((c) => s.includes(c.status)).reduce((n, c) => n + c._count, 0);
  // Default to whatever needs attention first.
  const filter = FILTERS.find((f) => f.key === sp.f) ?? (count(FILTERS[0].statuses) ? FILTERS[0] : FILTERS[1]);
  const orders = await db.order.findMany({
    where: {
      distributorId: distributor.id,
      OR: [
        { status: { in: filter.statuses } },
        // Orders just moved out of this list stay visible for 10 minutes, with their new status.
        ...(filter.leadsTo ? [{ status: { in: filter.leadsTo }, updatedAt: { gte: recentlyChanged() } }] : []),
      ],
    },
    orderBy: { createdAt: filter.key === "done" || filter.key === "cancelled" ? "desc" : "asc" },
    take: 100,
    include: { items: true, zone: true, shipment: true },
  });

  return (
    <>
      <PartnerNav current="orders" name={distributor.name} isOwner={member.role === "OWNER"} />
      <h1 className="font-display text-2xl font-bold">Orders</h1>
      <nav className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="Filter orders">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/partner?f=${f.key}`} aria-current={f.key === filter.key ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 ${f.key === filter.key ? "border-brand bg-brand-soft font-semibold text-brand" : "border-border bg-surface"}`}>
            {f.label} <span className="text-muted">({count(f.statuses)})</span>
          </Link>
        ))}
      </nav>
      {filter.key === "pay" && (
        <p className="mt-3 text-sm text-muted">
          Customers pay into your bank account using the order number as narration. Only tap <strong>Payment received</strong> once the money is in your account.
        </p>
      )}
      {orders.length === 0 ? <p className="mt-8 text-muted">Nothing here right now.</p> : (
        <ul className="mt-6 space-y-4">
          {orders.map((o) => {
            const next = NEXT_STATUSES[o.status].filter((s) => s !== "CANCELLED" || o.status === "PENDING_PAYMENT");
            return (
              <OrderCard key={o.id} o={o}>
                {o.status === "PENDING_PAYMENT" && o.paymentMethod === "BANK_TRANSFER" && (
                  <PaymentControls orderId={o.id} action={partnerPayment} customerSaysPaid={!!o.customerMarkedPaidAt} />
                )}
                {o.status !== "PENDING_PAYMENT" && next.length > 0 && (
                  <StatusForm orderId={o.id} action={partnerStatus}
                    options={next.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
                    rider={{ name: o.shipment?.riderName ?? "", phone: o.shipment?.riderPhone ?? "" }} />
                )}
              </OrderCard>
            );
          })}
        </ul>
      )}
    </>
  );
}

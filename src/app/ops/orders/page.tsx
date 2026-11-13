import Link from "next/link";
import { Suspense } from "react";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { NEXT_STATUSES } from "@/lib/status-text";
import { STATUS_LABEL } from "@/components/order-status";
import { OpsNav } from "../ops-nav";
import { StatusForm } from "@/components/status-form";
import { OrderCard } from "@/components/order-card";
import { PaymentControls } from "@/components/payment-controls";
import { opsConfirmTransfer, updateOrderStatus } from "../actions";

const FILTERS: { key: string; label: string; statuses: OrderStatus[]; leadsTo?: OrderStatus[] }[] = [
  { key: "todo", label: "To fulfil", statuses: ["PAID", "PROCESSING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "FAILED_DELIVERY"], leadsTo: ["DELIVERED", "CANCELLED"] },
  { key: "unpaid", label: "Awaiting payment", statuses: ["PENDING_PAYMENT"], leadsTo: ["PAID", "CANCELLED"] },
  { key: "done", label: "Delivered", statuses: ["DELIVERED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
];

const recentlyChanged = () => new Date(Date.now() - 10 * 60_000);

export default function OpsOrdersPage({ searchParams }: PageProps<"/ops/orders">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Orders searchParams={searchParams} />
    </Suspense>
  );
}

async function Orders({ searchParams }: Pick<PageProps<"/ops/orders">, "searchParams">) {
  await requireOps();
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.f) ?? FILTERS[0];
  const seller = typeof sp.d === "string" && sp.d ? sp.d : null;
  const [orders, counts, sellers] = await Promise.all([
    db.order.findMany({
      where: {
        ...(seller ? { distributorId: seller } : {}),
        OR: [
          { status: { in: filter.statuses } },
          // Orders just moved out of this list stay visible for 10 minutes, with their new status.
          ...(filter.leadsTo ? [{ status: { in: filter.leadsTo }, updatedAt: { gte: recentlyChanged() } }] : []),
        ],
      },
      orderBy: { createdAt: filter.key === "todo" ? "asc" : "desc" },
      take: 100,
      include: { items: true, zone: true, shipment: true, distributor: true },
    }),
    db.order.groupBy({ by: ["status"], where: seller ? { distributorId: seller } : {}, _count: true }),
    db.distributor.findMany({ orderBy: [{ isHq: "desc" }, { name: "asc" }], select: { id: true, name: true, isHq: true } }),
  ]);
  const count = (s: OrderStatus[]) => counts.filter((c) => s.includes(c.status)).reduce((n, c) => n + c._count, 0);

  return (
    <>
      <OpsNav current="orders" />
      {sp.owner === "1" && <p role="status" className="mb-4 rounded-xl bg-cta/25 p-3 text-sm">That page is for HQ owners only.</p>}
      <h1 className="font-display text-2xl font-bold">Orders</h1>
      <nav className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="Filter orders">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/ops/orders?f=${f.key}${seller ? `&d=${seller}` : ""}`} aria-current={f.key === filter.key ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 ${f.key === filter.key ? "border-brand bg-brand-soft font-semibold text-brand" : "border-border bg-surface"}`}>
            {f.label} <span className="text-muted">({count(f.statuses)})</span>
          </Link>
        ))}
      </nav>
      <nav className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Filter by seller">
        <span className="py-1 text-muted">Seller:</span>
        {[{ id: "", name: "All" }, ...sellers.map((x) => ({ id: x.id, name: x.isHq ? "HQ" : x.name }))].map((x) => (
          <Link key={x.id || "all"} href={`/ops/orders?f=${filter.key}${x.id ? `&d=${x.id}` : ""}`} aria-current={(seller ?? "") === x.id ? "page" : undefined}
            className={`rounded-full px-3 py-1 ${(seller ?? "") === x.id ? "bg-brand text-white" : "hover:bg-brand-soft"}`}>
            {x.name}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="mt-8 text-muted">No orders here.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((o) => (
            <OrderCard key={o.id} o={o} showSeller>
              {o.status === "PENDING_PAYMENT" && o.paymentMethod === "BANK_TRANSFER" && (
                <PaymentControls orderId={o.id} action={opsConfirmTransfer} customerSaysPaid={!!o.customerMarkedPaidAt} />
              )}
              {NEXT_STATUSES[o.status].length > 0 && (
                <StatusForm
                  orderId={o.id}
                  action={updateOrderStatus}
                  options={NEXT_STATUSES[o.status].map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
                  rider={{ name: o.shipment?.riderName ?? "", phone: o.shipment?.riderPhone ?? "" }}
                />
              )}
            </OrderCard>
          ))}
        </ul>
      )}
    </>
  );
}

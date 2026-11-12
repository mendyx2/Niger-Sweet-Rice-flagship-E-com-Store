import Link from "next/link";
import { Suspense } from "react";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { formatNaira } from "@/lib/money";
import { formatNgPhone } from "@/lib/phone";
import { NEXT_STATUSES } from "@/lib/status-text";
import { StatusPill, STATUS_LABEL } from "@/components/order-status";
import { OpsNav } from "../ops-nav";
import { StatusForm } from "./status-form";

const FILTERS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: "todo", label: "To fulfil", statuses: ["PAID", "PROCESSING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "FAILED_DELIVERY"] },
  { key: "unpaid", label: "Awaiting payment", statuses: ["PENDING_PAYMENT"] },
  { key: "done", label: "Delivered", statuses: ["DELIVERED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
];

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
  const [orders, counts] = await Promise.all([
    db.order.findMany({
      where: { status: { in: filter.statuses } },
      orderBy: { createdAt: filter.key === "todo" ? "asc" : "desc" },
      take: 100,
      include: { items: true, zone: true, shipment: true },
    }),
    db.order.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: OrderStatus[]) => counts.filter((c) => s.includes(c.status)).reduce((n, c) => n + c._count, 0);

  return (
    <>
      <OpsNav current="orders" />
      <h1 className="font-display text-2xl font-bold">Orders</h1>
      <nav className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="Filter orders">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/ops/orders?f=${f.key}`} aria-current={f.key === filter.key ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 ${f.key === filter.key ? "border-brand bg-brand-soft font-semibold text-brand" : "border-border bg-surface"}`}>
            {f.label} <span className="text-muted">({count(f.statuses)})</span>
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="mt-8 text-muted">No orders here.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((o) => {
            const addr = o.addressSnapshot as { street?: string; landmark?: string | null };
            return (
              <li key={o.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-lg">{o.number} <StatusPill status={o.status} /></p>
                    <p className="text-sm text-muted">
                      {o.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}
                    </p>
                  </div>
                  <p className="text-lg font-bold tabular-nums">{formatNaira(o.totalKobo)}</p>
                </div>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <p><span className="text-muted block">Items</span>{o.items.map((i) => `${i.qty} × ${i.sizeKg}kg`).join(", ")}</p>
                  <p>
                    <span className="text-muted block">Customer</span>
                    {o.customerName} · <a className="underline" href={`tel:${o.contactPhone}`}>{formatNgPhone(o.contactPhone)}</a>
                  </p>
                  <p>
                    <span className="text-muted block">{o.zone.kind === "PICKUP" ? "Pickup" : `Deliver to ${o.zone.name}`}</span>
                    {o.zone.kind === "PICKUP" ? "Flagship store" : `${addr.street ?? ""}${addr.landmark ? ` (near ${addr.landmark})` : ""}`}
                  </p>
                </div>
                {o.note && <p className="mt-2 rounded-lg bg-background p-2 text-sm">Note: {o.note}</p>}
                {NEXT_STATUSES[o.status].length > 0 && (
                  <StatusForm
                    orderId={o.id}
                    options={NEXT_STATUSES[o.status].map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
                    rider={{ name: o.shipment?.riderName ?? "", phone: o.shipment?.riderPhone ?? "" }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

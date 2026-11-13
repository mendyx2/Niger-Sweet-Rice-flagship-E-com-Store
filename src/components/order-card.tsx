import type { ReactNode } from "react";
import type { DeliveryZone, Distributor, Order, OrderItem, Shipment } from "@prisma/client";
import { formatNaira } from "@/lib/money";
import { formatNgPhone } from "@/lib/phone";
import { StatusPill } from "./order-status";

type CardOrder = Order & { items: OrderItem[]; zone: DeliveryZone; shipment: Shipment | null; distributor?: Distributor };
const when = (d: Date) => d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });

/** One order for staff (HQ in /ops, distributors in /partner). Controls are passed in. */
export function OrderCard({ o, showSeller = false, children }: { o: CardOrder; showSeller?: boolean; children?: ReactNode }) {
  const addr = o.addressSnapshot as { street?: string; landmark?: string | null };
  const pickup = o.zone.kind === "PICKUP";
  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-lg">
            {o.number} <StatusPill status={o.status} />
            {o.type !== "STANDARD" && <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-xs font-semibold">{o.type === "SAMPLE" ? "Free sample" : "Replacement"}</span>}
          </p>
          <p className="text-sm text-muted">{when(o.createdAt)}</p>
        </div>
        <p className="text-lg font-bold tabular-nums">{formatNaira(o.totalKobo)}</p>
      </div>
      {showSeller && o.distributor && (
        <p className="mt-2 text-sm">
          <span className="text-muted">Seller:</span> <strong>{o.distributor.isHq ? "HQ" : o.distributor.name}</strong>
          {o.routedToHq && <span className="ml-2 rounded-full bg-cta/30 px-2 py-0.5 text-xs font-semibold">Sent to HQ: area distributor short of stock</span>}
        </p>
      )}
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <p><span className="text-muted block">Items</span>{o.items.map((i) => `${i.qty} × ${i.sizeKg}kg`).join(", ")}</p>
        <p>
          <span className="text-muted block">Customer</span>
          {o.customerName} · <a className="underline" href={`tel:${o.contactPhone}`}>{formatNgPhone(o.contactPhone)}</a>
        </p>
        <p>
          <span className="text-muted block">{pickup ? "Pickup" : `Deliver to ${o.zone.name}`}</span>
          {pickup ? "Flagship store" : `${addr.street ?? ""}${addr.landmark ? ` (near ${addr.landmark})` : ""}`}
        </p>
      </div>
      {o.note && <p className="mt-2 rounded-lg bg-background p-2 text-sm">Note: {o.note}</p>}
      {o.status === "PENDING_PAYMENT" && o.paymentMethod === "BANK_TRANSFER" && (
        <p className={`mt-3 rounded-lg p-2 text-sm ${o.customerMarkedPaidAt ? "bg-cta/25 font-semibold" : "bg-background"}`}>
          {o.customerMarkedPaidAt
            ? `Customer says they transferred ${formatNaira(o.totalKobo)} at ${when(o.customerMarkedPaidAt)}. Check the bank account for narration ${o.number}.`
            : `Waiting for the customer's transfer of ${formatNaira(o.totalKobo)}${o.reservedUntil ? ` (held until ${when(o.reservedUntil)})` : ""}.`}
        </p>
      )}
      {o.paymentConfirmedAt && o.paymentMethod === "BANK_TRANSFER" && (
        <p className="mt-3 text-sm text-success">✓ Transfer confirmed {when(o.paymentConfirmedAt)}</p>
      )}
      {children}
    </li>
  );
}

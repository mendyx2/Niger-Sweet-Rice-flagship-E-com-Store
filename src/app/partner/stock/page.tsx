import { Suspense } from "react";
import { db } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { ActionForm } from "@/components/action-form";
import { PartnerNav } from "../partner-nav";
import { receiveStock, requestAdjustment } from "../actions";

const LABEL: Record<string, string> = {
  OPENING_BALANCE: "Opening balance", RESTOCK_SENT: "Sent by HQ", RESTOCK_RECEIVED: "Received from HQ", RESTOCK_SHORT: "Short on delivery",
  ONLINE_SALE: "Online sale", WALK_IN_SALE: "Shop sale", SAMPLE: "Free sample", REPLACEMENT: "Replacement bag",
  ORDER_CANCELLED: "Cancelled order returned", DAMAGED: "Damaged", COUNT_ADJUSTMENT: "Count correction", MANUAL_SET: "Set by HQ",
};
const when = (d: Date) => d.toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

export default function StockPage() {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Stock /></Suspense>;
}

async function Stock() {
  const { distributor, member } = await requirePartner({ next: "/partner/stock" });
  const [stock, movements, lastDelivery] = await Promise.all([
    db.distributorStock.findMany({ where: { distributorId: distributor.id }, include: { variant: true } }),
    db.stockMovement.findMany({ where: { distributorId: distributor.id }, include: { variant: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.stockMovement.findFirst({ where: { distributorId: distributor.id, type: { in: ["RESTOCK_RECEIVED", "RESTOCK_SHORT"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  // Everything recorded with the most recent receipt (same minute), to show "last delivery" after confirming.
  const lastLines = lastDelivery
    ? movements.filter((m) => (m.type === "RESTOCK_RECEIVED" || m.type === "RESTOCK_SHORT") && Math.abs(m.createdAt.getTime() - lastDelivery.createdAt.getTime()) < 60_000)
    : [];
  const rows = stock.sort((a, b) => b.variant.sizeKg - a.variant.sizeKg);
  const inTransit = rows.filter((s) => s.inTransit > 0);

  return (
    <>
      <PartnerNav current="stock" name={distributor.name} isOwner={member.role === "OWNER"} />
      <h1 className="font-display text-2xl font-bold">Stock</h1>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map((s) => (
          <div key={s.variantId} className="card p-4">
            <p className="text-sm text-muted">{s.variant.sizeKg}kg bags</p>
            <p className="font-display text-3xl font-bold tabular-nums">{s.onHand}</p>
            <p className="text-xs text-muted">{s.held ? `${s.held} held for unpaid orders · ` : ""}{s.onHand - s.held} free</p>
          </div>
        ))}
      </div>

      {inTransit.length === 0 && lastDelivery && (
        <p className="mt-6 rounded-2xl bg-brand-soft p-4 text-sm">
          <strong>Last delivery from HQ</strong> ({when(lastDelivery.createdAt)}):{" "}
          {lastLines.filter((m) => m.type === "RESTOCK_RECEIVED").map((m) => `${m.delta}×${m.variant.sizeKg}kg received`).join(", ") || "nothing received"}
          {lastLines.some((m) => m.type === "RESTOCK_SHORT") && (
            <>; short: {lastLines.filter((m) => m.type === "RESTOCK_SHORT").map((m) => `${-m.transitDelta}×${m.variant.sizeKg}kg`).join(", ")} (HQ has been told)</>
          )}
        </p>
      )}

      {inTransit.length > 0 && (
        <section className="mt-6 rounded-3xl border-2 border-cta bg-surface p-5">
          <h2 className="font-semibold text-lg">Delivery from HQ: confirm what arrived</h2>
          <p className="mt-1 text-sm text-muted">Count the bags. If anything is missing, enter what you actually received and HQ will be told.</p>
          <ActionForm action={receiveStock} submit="Confirm received" className="mt-3 space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-4">
              {inTransit.map((s) => (
                <label key={s.variantId} className="block">
                  <span className="font-semibold">{s.variant.sizeKg}kg: sent {s.inTransit}</span>
                  <input name={`received:${s.variantId}`} type="number" min={0} max={s.inTransit} defaultValue={s.inTransit} required className="field" />
                </label>
              ))}
            </div>
            <label className="block max-w-xs"><span className="font-semibold">Waybill / dispatch note no.</span><input name="reference" className="field" /></label>
          </ActionForm>
        </section>
      )}

      <section className="mt-6 card p-5">
        <h2 className="font-semibold text-lg">Report damaged bags or a count difference</h2>
        <p className="mt-1 text-sm text-muted">HQ approves these before your stock changes.</p>
        <ActionForm action={requestAdjustment} submit="Send to HQ" className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
          <label className="block"><span className="font-semibold">What</span>
            <select name="kind" className="field"><option value="DAMAGED">Damaged bags</option><option value="COUNT_ADJUSTMENT">My count is different</option></select>
          </label>
          <label className="block"><span className="font-semibold">Bag size</span>
            <select name="variantId" required className="field"><option value="">Choose…</option>{rows.map((s) => <option key={s.variantId} value={s.variantId}>{s.variant.sizeKg}kg</option>)}</select>
          </label>
          <label className="block"><span className="font-semibold">Number of bags</span><input name="qty" type="number" min={0} required className="field" />
            <span className="text-xs text-muted">Damaged: how many. Count: how many you counted.</span></label>
          <label className="block"><span className="font-semibold">What happened</span><input name="note" required className="field" /></label>
        </ActionForm>
      </section>

      <section className="mt-6 card p-5">
        <h2 className="font-semibold text-lg">Stock history</h2>
        {movements.length === 0 ? <p className="mt-2 text-sm text-muted">No stock movements yet.</p> : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {movements.map((m) => {
              const change = m.delta || m.transitDelta;
              return (
                <li key={m.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p><strong>{m.variant.sizeKg}kg</strong> · {LABEL[m.type]}</p>
                    {m.note && <p className="text-xs text-muted">{m.note}</p>}
                    <p className="text-xs text-muted">{when(m.createdAt)}</p>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <p className={`font-semibold ${change > 0 ? "text-success" : change < 0 ? "text-danger" : ""}`}>
                      {change > 0 ? "+" : ""}{change}{!m.delta && m.transitDelta ? " in transit" : ""}
                    </p>
                    <p className="text-xs text-muted">
                      {m.status === "APPLIED" ? (m.delta ? `now ${m.onHandAfter}` : "") : m.status === "PENDING_APPROVAL" ? "awaiting HQ" : "rejected"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

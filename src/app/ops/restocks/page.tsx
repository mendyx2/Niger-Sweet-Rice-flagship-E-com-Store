import Link from "next/link";
import { Suspense } from "react";
import type { RestockStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { formatNaira } from "@/lib/money";
import { bagsOwedByHq, type RestockLine } from "@/lib/restock";
import { ActionForm } from "@/components/action-form";
import { OpsNav } from "../ops-nav";
import { opsCancelRestock, opsConfirmRestockPayment, opsDispatchRestock, opsInvoiceRestock } from "./actions";

const FILTERS: { key: string; label: string; statuses: RestockStatus[] }[] = [
  { key: "new", label: "New requests", statuses: ["REQUESTED"] },
  { key: "pay", label: "Awaiting payment", statuses: ["INVOICED"] },
  { key: "send", label: "To dispatch", statuses: ["PAID"] },
  { key: "transit", label: "In transit", statuses: ["DISPATCHED"] },
  { key: "done", label: "Received", statuses: ["RECEIVED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
];
const when = (d: Date) => d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });
const bags = (lines: RestockLine[] | null) => (lines ?? []).map((l) => `${l.qty} × ${l.sizeKg}kg`).join(", ");
const recentlyChanged = () => new Date(Date.now() - 10 * 60_000);

export default function RestocksPage({ searchParams }: PageProps<"/ops/restocks">) {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Restocks searchParams={searchParams} /></Suspense>;
}

async function Restocks({ searchParams }: Pick<PageProps<"/ops/restocks">, "searchParams">) {
  await requireOps();
  const sp = await searchParams;
  const counts = await db.restockOrder.groupBy({ by: ["status"], _count: true });
  const count = (s: RestockStatus[]) => counts.filter((c) => s.includes(c.status)).reduce((n, c) => n + c._count, 0);
  const firstWithWork = FILTERS.slice(0, 3).find((f) => count(f.statuses) > 0) ?? FILTERS[0];
  const filter = FILTERS.find((f) => f.key === sp.f) ?? firstWithWork;
  const idx = FILTERS.indexOf(filter);
  const [list, variants, hqStock] = await Promise.all([
    db.restockOrder.findMany({
      where: {
        OR: [
          { status: { in: filter.statuses } },
          // Just moved on to the next step: stays visible for 10 minutes so you can see what happened.
          ...(idx < 4 ? [{ status: { in: [...FILTERS[idx + 1].statuses, "CANCELLED" as const] }, updatedAt: { gte: recentlyChanged() } }] : []),
        ],
      },
      include: { distributor: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    db.variant.findMany({ orderBy: { sizeKg: "desc" } }),
    db.distributorStock.findMany({ where: { distributorId: "hq" } }),
  ]);
  const hqFree = new Map(hqStock.map((s) => [s.variantId, s.onHand - s.held]));
  const owed = new Map(await Promise.all([...new Set(list.map((r) => r.distributorId))].map(async (d) => [d, await bagsOwedByHq(d)] as const)));

  return (
    <>
      <OpsNav current="restocks" />
      <h1 className="font-display text-2xl font-bold">Restocks</h1>
      <p className="mt-1 text-sm text-muted">Distributors buy stock from HQ at the distributor price. Invoice → they pay HQ by transfer → confirm → dispatch.</p>
      <nav className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="Filter restocks">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/ops/restocks?f=${f.key}`} aria-current={f.key === filter.key ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 ${f.key === filter.key ? "border-brand bg-brand-soft font-semibold text-brand" : "border-border bg-surface"}`}>
            {f.label} <span className="text-muted">({count(f.statuses)})</span>
          </Link>
        ))}
      </nav>
      {list.length === 0 ? <p className="mt-8 text-muted">Nothing here.</p> : (
        <ul className="mt-6 space-y-4">
          {list.map((r) => {
            const lines = r.lines as RestockLine[];
            const free = r.freeLines as RestockLine[] | null;
            const owedHere = owed.get(r.distributorId) ?? new Map();
            return (
              <li key={r.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-lg">{r.number} · {r.distributor.name}</p>
                    <p className="text-sm text-muted">Requested {when(r.createdAt)}{r.note ? ` · “${r.note}”` : ""}</p>
                  </div>
                  <span className="rounded-full bg-background px-2.5 py-0.5 text-xs font-semibold">{FILTERS.find((f) => f.statuses.includes(r.status))?.label}</span>
                </div>
                <p className="mt-2 text-sm"><span className="text-muted">Bags:</span> {bags(lines)}{free?.length ? <> + free: {bags(free)}</> : null}</p>
                {r.totalKobo > 0 && <p className="text-sm"><span className="text-muted">Invoice:</span> <strong>{formatNaira(r.totalKobo)}</strong></p>}
                {r.paidMarkedAt && r.status === "INVOICED" && <p className="mt-2 rounded-lg bg-cta/25 p-2 text-sm font-semibold">Distributor says they paid at {when(r.paidMarkedAt)}. Check HQ&apos;s account for narration {r.number}.</p>}
                {r.reference && <p className="text-sm"><span className="text-muted">Waybill:</span> {r.reference}</p>}
                <p className="mt-1 text-xs text-muted">
                  {[
                    r.invoicedAt && `Invoiced ${when(r.invoicedAt)}`,
                    r.paidAt && `Paid ${when(r.paidAt)}`,
                    r.dispatchedAt && `Dispatched ${when(r.dispatchedAt)}`,
                    r.receivedAt && `Received ${when(r.receivedAt)}`,
                    r.cancelledAt && `Cancelled ${when(r.cancelledAt)}`,
                  ].filter(Boolean).join(" · ")}
                </p>

                {r.status === "REQUESTED" && (
                  <div className="mt-4 border-t border-border pt-4">
                    <ActionForm action={opsInvoiceRestock} submit="Send invoice" className="space-y-3 text-sm">
                      <input type="hidden" name="id" value={r.id} />
                      <table className="w-full max-w-xl">
                        <thead className="text-left text-muted"><tr><th className="pb-1">Bag</th><th>Price each</th><th>Bags to sell</th><th>Free bags owed</th><th>HQ free stock</th></tr></thead>
                        <tbody>
                          {variants.map((v) => (
                            <tr key={v.id}>
                              <td className="py-1 font-semibold">{v.sizeKg}kg</td>
                              <td className="text-muted">{v.distributorCostKobo != null ? formatNaira(v.distributorCostKobo) : <Link href="/ops/prices" className="text-danger underline">set price</Link>}</td>
                              <td><input aria-label={`${r.number} ${v.sizeKg}kg bags`} name={`qty:${v.id}`} type="number" min={0} defaultValue={lines.find((l) => l.variantId === v.id)?.qty ?? 0} className="field mt-0 w-20 py-1" /></td>
                              <td><input aria-label={`${r.number} ${v.sizeKg}kg free bags`} name={`free:${v.id}`} type="number" min={0} defaultValue={owedHere.get(v.id) ?? 0} className="field mt-0 w-20 py-1" /></td>
                              <td className="text-muted">{hqFree.get(v.id) ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="text-xs text-muted">Free bags replace the free samples and replacement bags this distributor gave from its own stock.</p>
                    </ActionForm>
                  </div>
                )}
                {r.status === "INVOICED" && (
                  <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-4">
                    <ActionForm action={opsConfirmRestockPayment} submit="Payment received" buttonClass="btn-cta py-2" confirm="Is the money in HQ's account?">
                      <input type="hidden" name="id" value={r.id} />
                    </ActionForm>
                  </div>
                )}
                {r.status === "PAID" && (
                  <div className="mt-4 border-t border-border pt-4">
                    <ActionForm action={opsDispatchRestock} submit="Dispatch" className="flex flex-wrap items-end gap-3 text-sm" confirm="Take these bags off HQ's stock and send them?">
                      <input type="hidden" name="id" value={r.id} />
                      <label className="block"><span className="font-semibold">Waybill / dispatch note no.</span><input name="reference" className="field" /></label>
                    </ActionForm>
                  </div>
                )}
                {(r.status === "REQUESTED" || r.status === "INVOICED") && (
                  <div className="mt-3">
                    <ActionForm action={opsCancelRestock} submit="Cancel request" buttonClass="text-sm text-muted underline" confirm="Cancel this restock?">
                      <input type="hidden" name="id" value={r.id} />
                    </ActionForm>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

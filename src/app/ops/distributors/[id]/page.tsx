import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { formatNgPhone } from "@/lib/phone";
import { ActionForm } from "@/components/action-form";
import { OpsNav } from "../../ops-nav";
import { formatNaira } from "@/lib/money";
import { currentMonth, distributorMonth } from "@/lib/statement";
import { addMember, removeMember, reviewAdjustment, sendStock, updateAreas, updateBankDetails, updateDistributor } from "../actions";

export default function DistributorPage({ params }: PageProps<"/ops/distributors/[id]">) {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Distributor params={params} /></Suspense>;
}

const MOVEMENT_LABEL: Record<string, string> = {
  OPENING_BALANCE: "Opening balance", RESTOCK_SENT: "Sent by HQ", RESTOCK_RECEIVED: "Received", RESTOCK_SHORT: "Short on delivery",
  ONLINE_SALE: "Online sale", WALK_IN_SALE: "Shop sale", SAMPLE: "Free sample", REPLACEMENT: "Replacement bag",
  ORDER_CANCELLED: "Cancelled order returned", DAMAGED: "Damaged", COUNT_ADJUSTMENT: "Count correction", MANUAL_SET: "Set by HQ",
};
const when = (d: Date) => d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });

async function Distributor({ params }: Pick<PageProps<"/ops/distributors/[id]">, "params">) {
  await requireOps();
  const { id } = await params;
  const d = await db.distributor.findUnique({
    where: { id },
    include: {
      members: { include: { user: true }, orderBy: { createdAt: "asc" } },
      zones: true,
      stock: { include: { variant: true } },
    },
  });
  if (!d) notFound();
  const [zones, pending, movements] = await Promise.all([
    db.deliveryZone.findMany({ where: { kind: { not: "PICKUP" } }, orderBy: { sortOrder: "asc" }, include: { distributor: { select: { id: true, name: true } } } }),
    db.stockMovement.findMany({ where: { distributorId: id, status: "PENDING_APPROVAL" }, include: { variant: true }, orderBy: { createdAt: "asc" } }),
    db.stockMovement.findMany({ where: { distributorId: id }, include: { variant: true }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  const stock = [...d.stock].sort((a, b) => b.variant.sizeKg - a.variant.sizeKg);
  const month = d.isHq ? null : await distributorMonth(d.id, currentMonth());

  return (
    <>
      <OpsNav current="distributors" />
      <Link href="/ops/distributors" className="text-sm text-brand underline">← All distributors</Link>
      <h1 className="font-display text-3xl font-bold mt-2">{d.name}</h1>
      <p className="text-sm text-muted">{d.isHq ? "HQ serves areas without a distributor and orders distributors can't fill." : `Partner portal sign-in: ${d.members.length ? "set up" : "no logins yet"}`}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 items-start">
        <section className="card p-5">
          <h2 className="font-semibold text-lg">Details</h2>
          <ActionForm action={updateDistributor} submit="Save details" className="mt-3 space-y-3 text-sm">
            <input type="hidden" name="id" value={d.id} />
            <label className="block"><span className="font-semibold">Business name</span><input name="name" defaultValue={d.name} required className="field" /></label>
            <label className="block"><span className="font-semibold">Phone (gets new-order alerts)</span><input name="phone" type="tel" defaultValue={d.phone ? formatNgPhone(d.phone) : ""} className="field" /></label>
            <label className="block"><span className="font-semibold">Address</span><input name="address" defaultValue={d.address ?? ""} className="field" /></label>
            <label className="block"><span className="font-semibold">Opening hours</span><input name="hours" defaultValue={d.hours ?? ""} className="field" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="font-semibold">Hours to confirm a payment</span><input name="slaHours" type="number" min={1} max={72} defaultValue={d.slaHours} className="field" /></label>
              <label className="block"><span className="font-semibold">Status</span>
                <select name="status" defaultValue={d.status} className="field" disabled={d.isHq}>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
                {d.isHq && <input type="hidden" name="status" value="ACTIVE" />}
              </label>
            </div>
          </ActionForm>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold text-lg">Bank account customers pay into</h2>
          <p className="mt-1 text-sm text-muted">Only HQ can change this. Every change is logged and {d.isHq ? "HQ" : "the distributor"} is alerted by SMS.</p>
          {d.bankUpdatedAt && <p className="mt-1 text-xs text-muted">Last changed {when(d.bankUpdatedAt)}</p>}
          <ActionForm action={updateBankDetails} submit="Save bank details" className="mt-3 space-y-3 text-sm"
            confirm="Customers will be told to pay into this account. Have you verified it with the account holder?">
            <input type="hidden" name="id" value={d.id} />
            <label className="block"><span className="font-semibold">Bank</span><input name="bankName" defaultValue={d.bankName ?? ""} required className="field" /></label>
            <label className="block"><span className="font-semibold">Account number (10 digits)</span><input name="accountNumber" inputMode="numeric" maxLength={10} defaultValue={d.accountNumber ?? ""} required className="field tracking-wider" /></label>
            <label className="block"><span className="font-semibold">Account name</span><input name="accountName" defaultValue={d.accountName ?? ""} required className="field" /></label>
          </ActionForm>
        </section>

        {!d.isHq && (
          <section className="card p-5 lg:col-span-2">
            <h2 className="font-semibold text-lg">Areas</h2>
            <p className="mt-1 text-sm text-muted">One distributor per area. Ticking an area that belongs to someone else moves it here.</p>
            <ActionForm action={updateAreas} submit="Save areas" className="mt-3 space-y-4 text-sm">
              <input type="hidden" name="id" value={d.id} />
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {zones.map((z) => (
                  <label key={z.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                    <input type="checkbox" name="zone" value={z.id} defaultChecked={z.distributorId === d.id} className="h-4 w-4 accent-[var(--brand)]" />
                    <span>{z.name}{z.distributor && z.distributor.id !== d.id && <span className="block text-xs text-muted">now: {z.distributor.name}</span>}</span>
                  </label>
                ))}
              </div>
            </ActionForm>
          </section>
        )}

        <section className="card p-5">
          <h2 className="font-semibold text-lg">Partner portal logins</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {d.members.length === 0 && <li className="text-muted">No one yet.</li>}
            {d.members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2">
                <span>{m.user.name ?? "No name"} · {m.user.phone.startsWith("+") ? formatNgPhone(m.user.phone) : "deleted"} <span className="text-xs text-muted">{m.role === "OWNER" ? "Owner" : "Staff"}</span></span>
                <form action={removeMember}><input type="hidden" name="userId" value={m.userId} /><button className="text-xs text-danger underline">Remove</button></form>
              </li>
            ))}
          </ul>
          <ActionForm action={addMember} submit="Add login" className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <input type="hidden" name="id" value={d.id} />
            <label className="block"><span className="font-semibold">Name</span><input name="name" className="field" /></label>
            <label className="block"><span className="font-semibold">Mobile number</span><input name="phone" type="tel" required className="field" /></label>
            <label className="block sm:col-span-2"><span className="font-semibold">Role</span>
              <select name="role" className="field"><option value="OWNER">Owner (everything, incl. prices and staff)</option><option value="STAFF">Staff (orders, stock, shop sales)</option></select>
            </label>
          </ActionForm>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold text-lg">Stock</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-muted"><tr><th className="pb-2">Bag</th><th>On hand</th><th>Held</th><th>In transit</th>{!d.isHq && <th>Send</th>}</tr></thead>
            <tbody>
              {stock.map((s) => (
                <tr key={s.variantId} className="border-t border-border">
                  <td className="py-2 font-semibold">{s.variant.sizeKg}kg</td><td>{s.onHand}</td><td>{s.held}</td><td>{s.inTransit}</td>
                  {!d.isHq && <td><input form="send-stock" aria-label={`Send ${s.variant.sizeKg}kg`} name={`qty:${s.variantId}`} type="number" min={0} className="field mt-0 w-20 py-1.5" /></td>}
                </tr>
              ))}
            </tbody>
          </table>
          {d.isHq ? (
            <p className="mt-3 text-xs text-muted">Set HQ&apos;s own stock on the <Link href="/ops/prices" className="underline">Prices &amp; stock</Link> page.</p>
          ) : (
            <div id="send-stock-wrap" className="mt-3">
              <ActionForm id="send-stock" action={sendStock} submit="Dispatch from HQ" className="flex flex-wrap items-end gap-3 text-sm"
                confirm="Take these bags off HQ's stock and send them to this distributor?">
                <input type="hidden" name="id" value={d.id} />
                <label className="block"><span className="font-semibold">Dispatch note / waybill no.</span><input name="reference" className="field" /></label>
              </ActionForm>
              <p className="mt-2 text-xs text-muted">Enter quantities in the Send column, then dispatch. Stock counts as theirs once they confirm receipt.</p>
            </div>
          )}
        </section>

        {month && (
          <section className="card p-5">
            <h2 className="font-semibold text-lg">{month.label} so far</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Online sales ({month.onlineOrders} orders)</dt><dd className="tabular-nums">{formatNaira(month.goodsOnline)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Shop sales ({month.shopSales})</dt><dd className="tabular-nums">{formatNaira(month.shopTotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">HQ fee on bags sold online</dt><dd className="tabular-nums">{formatNaira(month.statement.hqFees)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Less: HQ-funded discounts</dt><dd className="tabular-nums">−{formatNaira(month.statement.hqCredits)}</dd></div>
              <div className="flex justify-between border-t border-border pt-1.5 font-bold">
                <dt>{month.statement.net >= 0 ? "Owed to HQ" : "HQ owes them"}</dt><dd className="tabular-nums">{formatNaira(Math.abs(month.statement.net))}</dd>
              </div>
            </dl>
            {month.statement.bagsToReplace.length > 0 && (
              <p className="mt-2 text-xs text-muted">Bags to replace in their next delivery: {month.statement.bagsToReplace.map((b) => `${b.qty}×${b.sizeKg}kg`).join(", ")}</p>
            )}
          </section>
        )}

        {pending.length > 0 && (
          <section className="card p-5 border-cta">
            <h2 className="font-semibold text-lg">Stock changes waiting for approval</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {pending.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-2">
                  <span><strong>{m.delta > 0 ? "+" : ""}{m.delta} × {m.variant.sizeKg}kg</strong> · {MOVEMENT_LABEL[m.type]}{m.note ? `: ${m.note}` : ""} <span className="text-xs text-muted">{when(m.createdAt)}</span></span>
                  <form action={reviewAdjustment} className="flex gap-2">
                    <input type="hidden" name="movementId" value={m.id} />
                    <button name="decision" value="approve" className="btn-primary py-1.5 px-4 text-sm">Approve</button>
                    <button name="decision" value="reject" className="text-sm underline">Reject</button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-lg">Stock history</h2>
          {movements.length === 0 ? <p className="mt-2 text-sm text-muted">No stock movements yet.</p> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted"><tr><th className="pb-2">When</th><th>Bag</th><th>Change</th><th>In transit</th><th>Stock after</th><th>What</th><th>Ref</th></tr></thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-t border-border">
                      <td className="py-1.5 whitespace-nowrap">{when(m.createdAt)}</td>
                      <td>{m.variant.sizeKg}kg</td>
                      <td className="tabular-nums">{m.delta ? `${m.delta > 0 ? "+" : ""}${m.delta}` : "—"}</td>
                      <td className="tabular-nums">{m.transitDelta ? `${m.transitDelta > 0 ? "+" : ""}${m.transitDelta}` : ""}</td>
                      <td className="tabular-nums">{m.status === "APPLIED" ? m.onHandAfter ?? "" : m.status === "PENDING_APPROVAL" ? "pending" : "rejected"}</td>
                      <td>{MOVEMENT_LABEL[m.type]}</td>
                      <td className="text-muted">{m.reference ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

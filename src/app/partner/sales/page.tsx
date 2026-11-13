import { Suspense } from "react";
import { db } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { formatNaira, koboToNairaInput } from "@/lib/money";
import { ActionForm } from "@/components/action-form";
import { PartnerNav } from "../partner-nav";
import { recordWalkInSale } from "../actions";

export default function SalesPage() {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Sales /></Suspense>;
}

async function Sales() {
  const { distributor, member } = await requirePartner({ next: "/partner/sales" });
  const [variants, prices, stock, recent] = await Promise.all([
    db.variant.findMany({ orderBy: { sizeKg: "desc" } }),
    db.distributorPrice.findMany({ where: { distributorId: distributor.id } }),
    db.distributorStock.findMany({ where: { distributorId: distributor.id } }),
    db.walkInSale.findMany({ where: { distributorId: distributor.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const price = new Map(prices.map((p) => [p.variantId, p.retailPriceKobo]));
  const free = new Map(stock.map((s) => [s.variantId, s.onHand - s.held]));

  return (
    <>
      <PartnerNav current="sales" name={distributor.name} isOwner={member.role === "OWNER"} />
      <h1 className="font-display text-2xl font-bold">Shop sales</h1>
      <p className="mt-1 text-sm text-muted">Record bags sold over the counter so your stock stays right.</p>
      <section className="mt-4 card p-5">
        <ActionForm action={recordWalkInSale} submit="Record sale" className="space-y-4 text-sm">
          <table className="w-full">
            <thead className="text-left text-muted"><tr><th className="pb-2">Bag</th><th>Bags sold</th><th>Price per bag ₦</th><th className="hidden sm:table-cell">Free stock</th></tr></thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className="border-t border-border">
                  <td className="py-2 font-semibold">{v.sizeKg}kg</td>
                  <td><input aria-label={`${v.sizeKg}kg bags sold`} name={`qty:${v.id}`} type="number" min={0} className="field mt-0 w-24 py-1.5" /></td>
                  <td><input aria-label={`${v.sizeKg}kg price per bag`} name={`price:${v.id}`} inputMode="decimal" defaultValue={koboToNairaInput(price.get(v.id) ?? null)} className="field mt-0 w-32 py-1.5" /></td>
                  <td className="hidden sm:table-cell text-muted">{free.get(v.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <label className="block max-w-xs"><span className="font-semibold">Paid by</span>
            <select name="paymentMethod" required className="field"><option value="">Choose…</option><option>Cash</option><option>Transfer</option><option>POS</option></select>
          </label>
        </ActionForm>
      </section>
      <section className="mt-6 card p-5">
        <h2 className="font-semibold text-lg">Recent shop sales</h2>
        {recent.length === 0 ? <p className="mt-2 text-sm text-muted">None yet.</p> : (
          <ul className="mt-2 divide-y divide-border text-sm">
            {recent.map((s) => (
              <li key={s.id} className="flex justify-between gap-3 py-2">
                <span>
                  {(s.lines as { sizeKg: number; qty: number }[]).map((l) => `${l.qty} × ${l.sizeKg}kg`).join(", ")}
                  <span className="block text-xs text-muted">{s.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })} · {s.paymentMethod}</span>
                </span>
                <strong className="tabular-nums">{formatNaira(s.totalKobo)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

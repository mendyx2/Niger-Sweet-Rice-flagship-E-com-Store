import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { formatNaira } from "@/lib/money";
import { currentMonth, distributorMonth, isMonth, monthRange } from "@/lib/statement";
import { ActionForm } from "@/components/action-form";
import { OpsNav } from "../ops-nav";
import { closeMonth, markSettled } from "./actions";

const shift = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
};

export default function StatementsPage({ searchParams }: PageProps<"/ops/statements">) {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Statements searchParams={searchParams} /></Suspense>;
}

async function Statements({ searchParams }: Pick<PageProps<"/ops/statements">, "searchParams">) {
  await requireOps();
  const sp = await searchParams;
  const now = currentMonth();
  const month = isMonth(sp.m) ? sp.m : shift(now, -1);
  const finished = month < now;
  const distributors = await db.distributor.findMany({ where: { isHq: false }, orderBy: { name: "asc" }, include: { statements: { where: { month } } } });
  const rows = await Promise.all(distributors.map(async (d) => ({ d, s: d.statements[0] ?? null, live: d.statements[0] ? null : await distributorMonth(d.id, month) })));
  const anyOpen = rows.some((r) => !r.s);
  const totals = rows.reduce((t, r) => t + (r.s ? r.s.netKobo : r.live!.statement.net), 0);

  return (
    <>
      <OpsNav current="statements" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Statements · {monthRange(month).label}</h1>
          <p className="mt-1 text-sm text-muted">Per distributor: HQ fee on bags sold online, less HQ-funded discounts. Settled by bank transfer outside the platform.</p>
        </div>
        <nav className="flex gap-2 text-sm" aria-label="Month">
          <Link href={`/ops/statements?m=${shift(month, -1)}`} className="rounded-full border border-border px-3 py-1.5 hover:bg-brand-soft">← Previous</Link>
          {month < now && <Link href={`/ops/statements?m=${shift(month, 1)}`} className="rounded-full border border-border px-3 py-1.5 hover:bg-brand-soft">Next →</Link>}
        </nav>
      </div>

      <div className="mt-6 overflow-x-auto card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr><th className="p-3">Distributor</th><th className="p-3">Online orders</th><th className="p-3">HQ fees</th><th className="p-3">Discount credits</th><th className="p-3">Net</th><th className="p-3">Bags to replace</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {rows.map(({ d, s, live }) => {
              const fees = s ? s.feesKobo : live!.statement.hqFees;
              const credits = s ? s.creditsKobo : live!.statement.hqCredits;
              const net = s ? s.netKobo : live!.statement.net;
              const replace = (s ? (s.bagsToReplace as { sizeKg: number; qty: number }[]) : live!.statement.bagsToReplace);
              return (
                <tr key={d.id} className="border-t border-border align-top">
                  <td className="p-3 font-semibold"><Link href={`/ops/distributors/${d.id}`} className="hover:underline">{d.name}</Link></td>
                  <td className="p-3">{s ? s.onlineOrders : live!.onlineOrders}</td>
                  <td className="p-3 tabular-nums">{formatNaira(fees)}</td>
                  <td className="p-3 tabular-nums">−{formatNaira(credits)}</td>
                  <td className="p-3 tabular-nums font-semibold">{net === 0 ? "—" : `${net > 0 ? "Owes HQ" : "HQ owes"} ${formatNaira(Math.abs(net))}`}</td>
                  <td className="p-3">{replace.length ? replace.map((b) => `${b.qty}×${b.sizeKg}kg`).join(", ") : "—"}</td>
                  <td className="p-3">
                    {!s ? <span className="text-muted">{finished ? "Not closed" : "Month in progress"}</span>
                      : s.status === "SETTLED" ? <span className="text-success">Settled {s.settledAt?.toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" })}{s.settleNote ? ` · ${s.settleNote}` : ""}</span>
                      : net === 0 ? <span className="text-muted">Nothing to settle</span>
                      : (
                        <ActionForm action={markSettled} submit="Mark settled" buttonClass="btn-primary py-1.5 px-4 text-sm" className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={s.id} />
                          <input name="note" placeholder="Transfer ref (optional)" className="field mt-0 w-40 py-1.5" aria-label={`${d.name} settlement reference`} />
                        </ActionForm>
                      )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-bold"><td className="p-3" colSpan={4}>Total</td><td className="p-3 tabular-nums">{totals >= 0 ? `Owed to HQ ${formatNaira(totals)}` : `HQ owes ${formatNaira(-totals)}`}</td><td colSpan={2} /></tr>
          </tfoot>
        </table>
      </div>

      {finished && anyOpen && (
        <div className="mt-4 card p-5">
          <p className="text-sm">Closing the month freezes these figures and texts each distributor their statement.</p>
          <ActionForm action={closeMonth} submit={`Close ${monthRange(month).label}`} className="mt-3" confirm="Close this month? The figures will be frozen.">
            <input type="hidden" name="month" value={month} />
          </ActionForm>
        </div>
      )}
      {!finished && <p className="mt-4 text-sm text-muted">This month is still in progress. Figures update as orders come in; close it after the month ends.</p>}
    </>
  );
}

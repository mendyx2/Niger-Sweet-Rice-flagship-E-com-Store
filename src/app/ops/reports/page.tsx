import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { formatNaira } from "@/lib/money";
import { buildReport } from "@/lib/reports";
import { OpsNav } from "../ops-nav";
import { SalesChart } from "./sales-chart";

const RANGES = [7, 30, 90] as const;

export default function ReportsPage({ searchParams }: PageProps<"/ops/reports">) {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Reports searchParams={searchParams} /></Suspense>;
}

/** Magnitude as a thin inline bar (single hue), with the value in text beside it. */
function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className="block h-2 w-full rounded-full bg-background" aria-hidden="true">
      <span className="block h-2 rounded-full" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%`, background: "#2f8a4f" }} />
    </span>
  );
}

function Table<T extends { salesKobo: number }>({ title, rows, cols, empty }: {
  title: string; rows: T[]; cols: { head: string; cell: (r: T) => React.ReactNode }[]; empty: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.salesKobo));
  return (
    <section className="card p-5">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="mt-3 text-sm text-muted">{empty}</p> : (
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-muted">
            <tr>{cols.map((c) => <th key={c.head} className="pb-2 font-medium">{c.head}</th>)}<th className="pb-2 font-medium text-right">Sales</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {cols.map((c) => <td key={c.head} className="py-2 pr-3">{c.cell(r)}</td>)}
                <td className="py-2 w-2/5">
                  <span className="flex items-center gap-3">
                    <Bar value={r.salesKobo} max={max} />
                    <span className="w-24 shrink-0 text-right tabular-nums">{formatNaira(r.salesKobo)}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

async function Reports({ searchParams }: Pick<PageProps<"/ops/reports">, "searchParams">) {
  await requireOps();
  const sp = await searchParams;
  const days = RANGES.find((r) => String(r) === sp.days) ?? 30;
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400_000);

  const orders = await db.order.findMany({
    where: { paidAt: { gte: new Date(from.toISOString().slice(0, 10) + "T00:00:00+01:00") }, status: { not: "CANCELLED" } },
    include: { items: true, zone: { select: { name: true } }, affiliate: { select: { code: true } } },
  });
  const r = buildReport(
    orders.map((o) => ({
      type: o.type, userId: o.userId, paidAt: o.paidAt!, subtotalKobo: o.subtotalKobo, discountKobo: o.discountKobo,
      deliveryFeeKobo: o.deliveryFeeKobo, zoneName: o.zone.name, couponId: o.couponId, referrerId: o.referrerId,
      affiliateCode: o.affiliate?.code ?? null, items: o.items,
    })),
    from, to,
  );
  const t = r.totals;
  const tiles = [
    { label: "Sales", value: formatNaira(t.salesKobo), sub: `after ${formatNaira(t.discountKobo)} discounts` },
    { label: "Orders", value: t.orders.toLocaleString("en-NG"), sub: `${formatNaira(t.avgOrderKobo)} average` },
    { label: "Rice sold", value: `${t.kg.toLocaleString("en-NG")}kg`, sub: `+ ${formatNaira(t.deliveryKobo)} delivery fees` },
    { label: "Free samples", value: t.samples.toLocaleString("en-NG"), sub: t.samples ? `${Math.round((t.samplesConverted / t.samples) * 100)}% went on to buy` : "none yet" },
  ];

  return (
    <>
      <OpsNav current="reports" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Sales report</h1>
        <nav className="flex gap-1 rounded-full border border-border bg-surface p-1 text-sm" aria-label="Period">
          {RANGES.map((d) => (
            <Link key={d} href={`/ops/reports?days=${d}`} aria-current={d === days ? "page" : undefined}
              className={`rounded-full px-3 py-1 ${d === days ? "bg-brand text-white" : "hover:bg-brand-soft"}`}>
              {d} days
            </Link>
          ))}
        </nav>
      </div>
      <p className="mt-1 text-sm text-muted">Paid orders only. Free samples and replacement bags are not counted as sales{t.replacements ? ` (${t.replacements} replacement${t.replacements === 1 ? "" : "s"} sent)` : ""}.</p>

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((x) => (
          <div key={x.label} className="card p-4">
            <dt className="text-sm text-muted">{x.label}</dt>
            <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{x.value}</dd>
            <dd className="text-xs text-muted">{x.sub}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-6 card p-5">
        <h2 className="font-semibold">Sales per day</h2>
        <div className="mt-3"><SalesChart days={r.days} /></div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-brand">Show as table</summary>
          <table className="mt-2 w-full">
            <thead className="text-left text-muted"><tr><th className="py-1">Day</th><th>Orders</th><th className="text-right">Sales</th></tr></thead>
            <tbody>
              {r.days.filter((d) => d.orders).map((d) => (
                <tr key={d.day} className="border-t border-border"><td className="py-1">{d.day}</td><td>{d.orders}</td><td className="text-right tabular-nums">{formatNaira(d.salesKobo)}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Table title="By bag size (before discounts)" rows={r.bySize} empty="No sales yet."
          cols={[{ head: "Bag", cell: (x) => `${x.sizeKg}kg` }, { head: "Bags", cell: (x) => x.bags.toLocaleString("en-NG") }]} />
        <Table title="Where sales came from" rows={r.byChannel} empty="No sales yet."
          cols={[{ head: "Channel", cell: (x) => x.channel }, { head: "Orders", cell: (x) => x.orders }]} />
        <Table title="Top delivery areas" rows={r.byArea.slice(0, 10)} empty="No sales yet."
          cols={[{ head: "Area", cell: (x) => x.area }, { head: "Orders", cell: (x) => x.orders }]} />
        <Table title="Top affiliates" rows={r.byAffiliate} empty="No affiliate sales in this period."
          cols={[{ head: "Code", cell: (x) => <span className="font-mono">{x.code}</span> }, { head: "Orders", cell: (x) => x.orders }]} />
      </div>
    </>
  );
}

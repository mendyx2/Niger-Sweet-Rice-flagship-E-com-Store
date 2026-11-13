import Link from "next/link";
import { Suspense } from "react";
import { requirePartner } from "@/lib/partner-auth";
import { formatNaira } from "@/lib/money";
import { currentMonth, distributorMonth, isMonth } from "@/lib/statement";
import { PartnerNav } from "../partner-nav";

export default function ReportsPage({ searchParams }: PageProps<"/partner/reports">) {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Reports searchParams={searchParams} /></Suspense>;
}

function shift(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

async function Reports({ searchParams }: Pick<PageProps<"/partner/reports">, "searchParams">) {
  const { distributor, member } = await requirePartner({ next: "/partner/reports" });
  const sp = await searchParams;
  const month = isMonth(sp.m) ? sp.m : currentMonth();
  const r = await distributorMonth(distributor.id, month);
  const s = r.statement;
  const tiles = [
    { label: "Online sales", value: formatNaira(r.goodsOnline), sub: `${r.onlineOrders} orders + ${formatNaira(r.deliveryFees)} delivery fees` },
    { label: "Shop sales", value: formatNaira(r.shopTotal), sub: `${r.shopSales} sales` },
    { label: "Bags sold", value: r.bags.reduce((n, b) => n + b.online + b.shop, 0).toLocaleString("en-NG"), sub: "online + shop" },
  ];

  return (
    <>
      <PartnerNav current="reports" name={distributor.name} isOwner={member.role === "OWNER"} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{r.label}</h1>
        <nav className="flex gap-2 text-sm" aria-label="Month">
          <Link href={`/partner/reports?m=${shift(month, -1)}`} className="rounded-full border border-border px-3 py-1.5 hover:bg-brand-soft">← Previous</Link>
          {month !== currentMonth() && <Link href={`/partner/reports?m=${shift(month, 1)}`} className="rounded-full border border-border px-3 py-1.5 hover:bg-brand-soft">Next →</Link>}
        </nav>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="card p-4">
            <dt className="text-sm text-muted">{t.label}</dt>
            <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{t.value}</dd>
            <dd className="text-xs text-muted">{t.sub}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 items-start">
        <section className="card p-5">
          <h2 className="font-semibold text-lg">Bags sold by size</h2>
          {r.bags.length === 0 ? <p className="mt-2 text-sm text-muted">No sales this month.</p> : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-muted"><tr><th className="pb-2">Bag</th><th>Online</th><th>Shop</th><th>Total</th></tr></thead>
              <tbody>
                {r.bags.map((b) => (
                  <tr key={b.sizeKg} className="border-t border-border"><td className="py-1.5 font-semibold">{b.sizeKg}kg</td><td>{b.online}</td><td>{b.shop}</td><td>{b.online + b.shop}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="card p-5">
          <h2 className="font-semibold text-lg">Statement with HQ</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">HQ fee on bags sold online</dt><dd className="tabular-nums">{formatNaira(s.hqFees)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Less: HQ promotions &amp; points discounts on your orders</dt><dd className="tabular-nums text-success">−{formatNaira(s.hqCredits)}</dd></div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <dt>{s.net >= 0 ? "You owe HQ" : "HQ owes you"}</dt><dd className="tabular-nums">{formatNaira(Math.abs(s.net))}</dd>
            </div>
          </dl>
          {s.bagsToReplace.length > 0 && (
            <p className="mt-3 text-sm text-muted">
              Bags HQ will replace in your next delivery:{" "}
              {s.bagsToReplace.map((b) => `${b.qty}×${b.sizeKg}kg (${b.type === "SAMPLE" ? "free sample" : "replacement"})`).join(", ")}
            </p>
          )}
          <p className="mt-3 text-xs text-muted">Settled with HQ by bank transfer at the end of the month.</p>
        </section>
      </div>
    </>
  );
}

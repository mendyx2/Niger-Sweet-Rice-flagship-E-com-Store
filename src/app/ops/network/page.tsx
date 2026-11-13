import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { formatNaira } from "@/lib/money";
import { DISTRIBUTOR_COLOURS, HQ_COLOUR, MAP_HEIGHT, MAP_WIDTH, ZONE_POSITIONS, dotRadius } from "@/lib/network-map";
import { OpsNav } from "../ops-nav";

export default function NetworkPage() {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Network /></Suspense>;
}

const DAYS = 30;
const windowStart = () => new Date(Date.now() - DAYS * 86_400_000);

async function Network() {
  await requireOps();
  const since = windowStart();
  const [zones, distributors, sales] = await Promise.all([
    db.deliveryZone.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true, kind: true, distributorId: true } }),
    db.distributor.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, isHq: true, status: true, stock: { select: { onHand: true, variant: { select: { sizeKg: true } } } } },
    }),
    db.order.groupBy({
      by: ["zoneId", "distributorId"],
      where: { createdAt: { gte: since }, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } },
      _count: true,
      _sum: { totalKobo: true },
    }),
  ]);

  // Colour follows the distributor (by age), so adding or pausing one never repaints the others.
  const partners = distributors.filter((d) => !d.isHq);
  const colour = new Map(partners.map((d, i) => [d.id, DISTRIBUTOR_COLOURS[i] ?? HQ_COLOUR]));
  const byId = new Map(distributors.map((d) => [d.id, d]));
  const ordersInZone = new Map<string, number>();
  const perSeller = new Map<string, { orders: number; kobo: number }>();
  for (const s of sales) {
    ordersInZone.set(s.zoneId, (ordersInZone.get(s.zoneId) ?? 0) + s._count);
    const p = perSeller.get(s.distributorId ?? "hq") ?? { orders: 0, kobo: 0 };
    perSeller.set(s.distributorId ?? "hq", { orders: p.orders + s._count, kobo: p.kobo + (s._sum.totalKobo ?? 0) });
  }
  const sellerName = (id: string | null) => (id ? byId.get(id)?.name : null) ?? "HQ";
  const placed = zones.filter((z) => ZONE_POSITIONS[z.slug]);
  const hqAreas = zones.filter((z) => !z.distributorId && z.kind !== "PICKUP").length;

  return (
    <>
      <OpsNav current="network" />
      <h1 className="font-display text-2xl font-bold">Network map</h1>
      <p className="text-sm text-muted mt-1">
        Who covers each area, and paid orders there in the last {DAYS} days (bigger dot = more orders).
        Positions are approximate. Grey outlined areas are served by HQ.
      </p>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Key">
        {partners.map((d) => (
          <li key={d.id} className="flex items-center gap-2">
            <span aria-hidden className="inline-block size-3 rounded-full" style={{ background: colour.get(d.id) }} />
            <Link href={`/ops/distributors/${d.id}`} className="underline-offset-2 hover:underline">{d.name}</Link>
            {d.status !== "ACTIVE" && <span className="text-xs text-muted">({d.status.toLowerCase()})</span>}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden className="inline-block size-3 rounded-full border-2 bg-white" style={{ borderColor: HQ_COLOUR }} />
          HQ ({hqAreas} areas)
        </li>
      </ul>

      <figure className="mt-4 rounded-2xl border border-border bg-surface overflow-x-auto">
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="w-full min-w-[560px] h-auto" role="img"
          aria-label="Schematic map of Abuja delivery areas coloured by distributor. The same information is in the table below.">
          <text x={MAP_WIDTH - 20} y={40} textAnchor="end" fontSize={18} fill="#6b6b66">N ↑</text>
          {placed.map((z) => {
            const { x, y } = ZONE_POSITIONS[z.slug];
            const n = ordersInZone.get(z.id) ?? 0;
            const r = dotRadius(n);
            const c = z.distributorId ? colour.get(z.distributorId) ?? HQ_COLOUR : null;
            const label = `${z.name}: ${sellerName(z.distributorId)}, ${n} order${n === 1 ? "" : "s"} in ${DAYS} days${z.kind === "NEARBY_TOWN" ? " (minimum order applies)" : ""}`;
            const dot = (
              <g className="group">
                <title>{label}</title>
                {/* Invisible larger target so small dots are easy to hover or tap */}
                <circle cx={x} cy={y} r={Math.max(r, 22)} fill="transparent" />
                <circle cx={x} cy={y} r={r} fill={c ?? "#ffffff"} stroke={c ? "#ffffff" : HQ_COLOUR} strokeWidth={c ? 2 : 2.5}
                  strokeDasharray={z.kind === "NEARBY_TOWN" ? "5 3" : undefined}
                  className="transition-[stroke-width] group-hover:[stroke-width:4]" />
                {n > 0 && <text x={x} y={y + 6} textAnchor="middle" fontSize={17} fontWeight={700} fill={c ? "#ffffff" : "#33332f"}>{n}</text>}
                <text x={x} y={y + r + 20} textAnchor="middle" fontSize={18} fill="#33332f">{z.name}</text>
              </g>
            );
            return z.distributorId
              ? <Link key={z.id} href={`/ops/distributors/${z.distributorId}`}>{dot}</Link>
              : <Link key={z.id} href="/ops/zones">{dot}</Link>;
          })}
        </svg>
        <figcaption className="px-4 pb-3 text-xs text-muted"><span className="sm:hidden">Swipe sideways to see the whole map. </span>Dashed outline = nearby town with a minimum order. Tap an area to open its distributor.</figcaption>
      </figure>

      <div className="mt-8 grid gap-8 lg:grid-cols-2 items-start">
        <section>
          <h2 className="font-semibold">Sellers, last {DAYS} days</h2>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-muted [&_th]:font-normal [&_th]:pr-3"><tr><th className="py-1">Seller</th><th>Areas</th><th>Orders</th><th>Sales</th></tr></thead>
            <tbody>
              {distributors.map((d) => {
                const s = perSeller.get(d.id) ?? { orders: 0, kobo: 0 };
                const areas = d.isHq ? hqAreas : zones.filter((z) => z.distributorId === d.id).length;
                const stock = [...d.stock].sort((a, b) => b.variant.sizeKg - a.variant.sizeKg).map((x) => `${x.variant.sizeKg}kg ${x.onHand}`).join(" · ");
                return [
                  <tr key={d.id} className="border-t border-border align-middle">
                    <td className="py-2 pr-2">
                      <span className="flex items-center gap-2">
                        <span aria-hidden className={`inline-block size-2.5 shrink-0 rounded-full ${d.isHq ? "border-2 bg-white" : ""}`} style={d.isHq ? { borderColor: HQ_COLOUR } : { background: colour.get(d.id) }} />
                        {d.isHq ? "HQ" : <Link href={`/ops/distributors/${d.id}`} className="underline">{d.name}</Link>}
                      </span>
                    </td>
                    <td className="pr-3">{areas}</td><td className="pr-3">{s.orders}</td><td className="whitespace-nowrap">{formatNaira(s.kobo)}</td>
                  </tr>,
                  <tr key={`${d.id}-stock`}><td colSpan={4} className="pb-2 text-xs text-muted">In stock: {stock || "none"}</td></tr>,
                ];
              })}
            </tbody>
          </table>
        </section>
        <section>
          <h2 className="font-semibold">Areas</h2>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-muted [&_th]:font-normal [&_th]:pr-3"><tr><th className="py-1">Area</th><th>Served by</th><th>Orders</th></tr></thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} className="border-t border-border">
                  <td className="py-1.5 pr-2">{z.name}{z.kind === "NEARBY_TOWN" && <span className="text-xs text-muted"> · min order</span>}{!ZONE_POSITIONS[z.slug] && z.kind !== "PICKUP" && <span className="text-xs text-muted"> · not on map</span>}</td>
                  <td>{sellerName(z.distributorId)}</td>
                  <td>{ordersInZone.get(z.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

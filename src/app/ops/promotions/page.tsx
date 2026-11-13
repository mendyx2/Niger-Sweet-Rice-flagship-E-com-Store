import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { formatNaira } from "@/lib/money";
import { OpsNav } from "../ops-nav";
import { togglePromotion } from "../actions";
import { PromotionForm } from "./promotion-form";

export default function PromotionsOpsPage() {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Promotions /></Suspense>;
}

const d = (x: Date | null) => (x ? x.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }) : "no end date");

async function Promotions() {
  await requireOps();
  const [promos, coupons, distCodes] = await Promise.all([
    db.promotion.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    db.coupon.findMany({ where: { source: "PROMO" }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.coupon.findMany({ where: { source: "DISTRIBUTOR" }, orderBy: { createdAt: "desc" }, take: 50, include: { distributor: { select: { name: true } } } }),
  ]);
  const byCode = new Map(coupons.map((c) => [c.code, c]));
  return (
    <>
      <OpsNav current="promotions" />
      <h1 className="font-display text-2xl font-bold">Promotions</h1>
      <p className="text-sm text-muted mt-1">
        Promotions appear on the Promotions page. Add a coupon code to give a discount at checkout. To show a &ldquo;was&rdquo; price on a bag instead, use the Prices page.
      </p>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_420px] items-start">
        <ul className="space-y-3">
          {promos.length === 0 && <li className="text-muted">No promotions yet.</li>}
          {promos.map((p) => {
            const c = p.couponCode ? byCode.get(p.couponCode) : null;
            const now = new Date();
            const live = p.active && p.startsAt <= now && (!p.endsAt || p.endsAt > now);
            return (
              <li key={p.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{p.title} {p.badge && <span className="ml-1 rounded-full bg-promo px-2 py-0.5 text-xs text-white">{p.badge}</span>}</p>
                    <p className="text-sm text-muted">{d(p.startsAt)} → {d(p.endsAt)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${live ? "bg-success/15 text-success" : "bg-border text-muted"}`}>
                    {live ? "Live" : p.active ? "Scheduled / ended" : "Paused"}
                  </span>
                </div>
                <p className="mt-2 text-sm">{p.body}</p>
                {c && (
                  <p className="mt-2 text-sm">
                    Code <span className="font-mono font-bold">{c.code}</span>: {c.type === "PERCENT" ? `${c.value}% off` : `${formatNaira(c.value)} off`}
                    {c.minOrderKobo ? `, min ${formatNaira(c.minOrderKobo)}` : ""} · used {c.usedCount}/{c.maxUses >= 100_000 ? "∞" : c.maxUses}
                  </p>
                )}
                <form action={togglePromotion} className="mt-3">
                  <input type="hidden" name="id" value={p.id} />
                  <button className="text-sm underline">{p.active ? "Pause" : "Resume"}</button>
                </form>
              </li>
            );
          })}
        </ul>
        <div className="space-y-6">
        <section className="card p-5">
          <h2 className="font-semibold text-lg">New promotion</h2>
          <PromotionForm />
        </section>
        <section className="card p-5">
          <h2 className="font-semibold text-lg">Distributors&apos; own codes</h2>
          <p className="mt-1 text-xs text-muted">Funded by the distributor, valid only on their orders, not credited on statements.</p>
          {distCodes.length === 0 ? <p className="mt-2 text-sm text-muted">None yet.</p> : (
            <ul className="mt-2 divide-y divide-border text-sm">
              {distCodes.map((c) => (
                <li key={c.id} className="py-2">
                  <strong className="font-mono">{c.code}</strong> · {c.distributor?.name} · {c.type === "PERCENT" ? `${c.value}%` : formatNaira(c.value)} off · used {c.usedCount}
                  {c.expiresAt && c.expiresAt < new Date() ? <span className="ml-1 text-xs text-muted">(ended)</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>
      </div>
    </>
  );
}

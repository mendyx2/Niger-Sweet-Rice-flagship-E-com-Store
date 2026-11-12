import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatNaira } from "@/lib/money";
import { formatNgPhone } from "@/lib/phone";
import { pointsBalance } from "@/lib/points-balance";
import { DEFAULT_REWARD_RULES, rewardProgress } from "@/lib/rewards";
import { availableCoupons } from "@/lib/redeem";
import { site } from "@/lib/site";
import { StatusPill } from "@/components/order-status";
import { signOut } from "../login/actions";
import { applyAsAffiliate } from "./actions";
import { affiliateStats } from "@/lib/affiliate-stats";
import { getProducts } from "@/lib/catalogue";
import { DeleteAccountForm, ProfileForm, RedeemForm } from "./forms";
import { CopyButton } from "./copy-button";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <Suspense fallback={<p className="text-muted">Loading your account…</p>}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  const user = await requireUser("/account");
  const [orders, points, coupons] = await Promise.all([
    db.order.findMany({
      where: { userId: user.id, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { items: true },
    }),
    pointsBalance(user.id),
    availableCoupons(user.id),
  ]);
  const progress = rewardProgress(points.confirmed);
  const affiliate = await db.affiliateProfile.findUnique({ where: { userId: user.id } });
  const [affStats, products] = affiliate?.status === "APPROVED" ? await Promise.all([affiliateStats(user.id), getProducts()]) : [null, []];
  const refLink = `${site.url}/r/${user.referralCode}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">Hello{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
          <p className="text-muted mt-1">{formatNgPhone(user.phone)}</p>
        </div>
        <form action={signOut}><button className="text-sm text-muted underline">Sign out</button></form>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <section className="rounded-3xl bg-brand p-6 text-white md:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/75">Purchase points</h2>
          <p className="mt-2 font-display text-5xl font-bold">{points.confirmed.toLocaleString("en-NG")}</p>
          {points.pending > 0 && (
            <p className="mt-1 text-sm text-white/80">+{points.pending.toLocaleString("en-NG")} pending (confirmed 48h after delivery)</p>
          )}
          {progress.next && (
            <div className="mt-5">
              <div className="h-2 rounded-full bg-white/20" role="progressbar" aria-valuemin={0} aria-valuemax={progress.next.points} aria-valuenow={points.confirmed}>
                <div className="h-2 rounded-full bg-cta" style={{ width: `${Math.min(100, (points.confirmed / progress.next.points) * 100)}%` }} />
              </div>
              <p className="mt-2 text-sm text-white/85">
                {progress.pointsToNext.toLocaleString("en-NG")} more points for a {formatNaira(progress.next.couponKobo)} coupon
              </p>
            </div>
          )}
        </section>
        <section className="card p-6">
          <h2 className="font-semibold">Invite friends, earn points</h2>
          <p className="mt-1 text-sm text-muted">You earn points on your friends&apos; orders, plus a bonus on their first.</p>
          <p className="mt-3 rounded-lg bg-background px-3 py-2 text-sm font-mono break-all">{refLink}</p>
          <CopyButton text={refLink} label="Share link" share />
        </section>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold">Turn points into discounts</h2>
        <p className="text-muted mt-1">Each coupon is for you only and can be used once within {DEFAULT_REWARD_RULES.couponValidDays} days.</p>
        <div className="mt-4">
          <RedeemForm
            balance={points.confirmed}
            tiers={DEFAULT_REWARD_RULES.tiers.map((t) => ({ points: t.points, label: `${formatNaira(t.couponKobo)} off`, minOrder: formatNaira(t.minOrderKobo) }))}
          />
        </div>
        {coupons.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold">Your coupons</h3>
            <ul className="mt-2 grid gap-3 sm:grid-cols-2">
              {coupons.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-cta bg-cta/10 p-4">
                  <span>
                    <span className="block font-mono text-lg font-bold tracking-wider">{c.code}</span>
                    <span className="text-sm text-muted">
                      {c.type === "FIXED" ? `${formatNaira(c.value)} off` : `${c.value}% off`}
                      {c.minOrderKobo ? ` orders over ${formatNaira(c.minOrderKobo)}` : ""}
                      {c.expiresAt ? ` · until ${c.expiresAt.toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" })}` : ""}
                    </span>
                  </span>
                  <CopyButton text={c.code} label="Copy" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold">Your orders</h2>
        {orders.length === 0 ? (
          <div className="mt-4 card p-6 text-muted">
            No orders yet. <Link href="/shop" className="text-brand font-semibold underline">Start shopping</Link>
          </div>
        ) : (
          <ul className="mt-4 card divide-y divide-border">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.number}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-background">
                  <span>
                    <span className="font-semibold">{o.number}</span>
                    <span className="block text-sm text-muted">
                      {o.createdAt.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" })} ·{" "}
                      {o.items.map((i) => `${i.qty}×${i.sizeKg}kg`).join(", ")}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <StatusPill status={o.status} />
                    <span className="font-semibold tabular-nums">{formatNaira(o.totalKobo)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 card p-6">
        <h2 className="font-display text-xl font-bold">Affiliate programme</h2>
        {!affiliate || affiliate.status === "REJECTED" ? (
          <>
            <p className="mt-2 text-muted">
              Share our rice on WhatsApp, Instagram or your shop and earn 2 points for every ₦100 people spend through your links,
              redeemable for discount coupons.
            </p>
            <form action={applyAsAffiliate}><button className="btn-outline mt-4">Become an affiliate</button></form>
          </>
        ) : affiliate.status === "PENDING" ? (
          <p className="mt-2 text-muted">Your application is under review. We&apos;ll text you when it&apos;s approved.</p>
        ) : affStats && (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Clicks (30 days)", affStats.clicks30.toLocaleString("en-NG")],
                ["Orders (30 days)", affStats.orders30.toLocaleString("en-NG")],
                ["Sales via your links", formatNaira(affStats.salesKobo)],
                ["Points earned", `${affStats.pointsConfirmed.toLocaleString("en-NG")}${affStats.pointsPending ? ` (+${affStats.pointsPending.toLocaleString("en-NG")} pending)` : ""}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-background p-3">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-1 font-bold text-lg">{v}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-6 font-semibold">Your links</h3>
            <ul className="mt-2 space-y-2 text-sm">
              <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background p-3">
                <span className="font-mono break-all">{site.url}/a/{affiliate.code}</span>
                <CopyButton text={`${site.url}/a/${affiliate.code}`} label="Copy" />
              </li>
              {products.flatMap((p) => p.variants.filter((v) => v.retailPriceKobo != null).map((v) => {
                const url = `${site.url}/a/${affiliate.code}?p=${p.slug}&size=${v.sizeKg}`;
                return (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background p-3">
                    <span><strong>{v.sizeKg}kg bag</strong> <span className="font-mono text-muted break-all">{url}</span></span>
                    <CopyButton text={url} label="Copy" />
                  </li>
                );
              }))}
            </ul>
          </>
        )}
      </section>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-display text-xl font-bold">Your details</h2>
          <div className="mt-4"><ProfileForm name={user.name ?? ""} email={user.email ?? ""} /></div>
        </section>
        <section className="card p-6">
          <h2 className="font-display text-xl font-bold">Sell or resell our rice</h2>
          {user.sellerProfile ? (
            <p className="mt-2">
              {user.sellerProfile.businessName}:{" "}
              <strong>
                {{ PENDING: "application under review", APPROVED: "approved, wholesale prices apply", REJECTED: "not approved" }[user.sellerProfile.status]}
              </strong>
            </p>
          ) : (
            <>
              <p className="mt-2 text-muted">Shops, caterers and distributors can apply for wholesale prices.</p>
              <Link href="/register?as=seller" className="btn-outline mt-4">Apply to sell</Link>
            </>
          )}
        </section>
      </div>

      <details className="mt-10 card p-6">
        <summary className="cursor-pointer font-semibold">Delete my account</summary>
        <DeleteAccountForm />
      </details>
    </>
  );
}

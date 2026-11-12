import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatNaira } from "@/lib/money";
import { formatNgPhone } from "@/lib/phone";
import { pointsBalance } from "@/lib/points-balance";
import { rewardProgress } from "@/lib/rewards";
import { site } from "@/lib/site";
import { StatusPill } from "@/components/order-status";
import { signOut } from "../login/actions";
import { ProfileForm } from "./forms";
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
  const [orders, points] = await Promise.all([
    db.order.findMany({
      where: { userId: user.id, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { items: true },
    }),
    pointsBalance(user.id),
  ]);
  const progress = rewardProgress(points.confirmed);
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
          <CopyButton text={refLink} />
        </section>
      </div>

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
    </>
  );
}

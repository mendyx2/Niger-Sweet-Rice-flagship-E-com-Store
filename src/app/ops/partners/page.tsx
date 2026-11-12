import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { formatNgPhone } from "@/lib/phone";
import { OpsNav } from "../ops-nav";
import { reviewAffiliate, reviewSeller } from "../actions";

export default function PartnersPage() {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Partners /></Suspense>;
}

async function Partners() {
  await requireOps();
  const [sellers, affiliates] = await Promise.all([
    db.sellerProfile.findMany({ include: { user: true }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200 }),
    db.affiliateProfile.findMany({ include: { user: true, _count: { select: { clicks: true, orders: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200 }),
  ]);
  return (
    <>
      <OpsNav current="partners" />
      <h1 className="font-display text-2xl font-bold">Seller applications</h1>
      <p className="text-sm text-muted mt-1">Approved sellers see wholesale prices (set them on the Prices page).</p>
      {sellers.length === 0 ? <p className="mt-4 text-muted">No applications yet.</p> : (
        <ul className="mt-4 space-y-3">
          {sellers.map((s) => (
            <li key={s.userId} className="card p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm">
                <p className="font-bold text-base">{s.businessName} <span className="ml-2 text-xs font-semibold text-muted">{s.status}</span></p>
                <p>{s.user.name} · {formatNgPhone(s.user.phone)}{s.cacNumber ? ` · CAC ${s.cacNumber}` : ""}</p>
                <p className="text-muted">{s.address}</p>
              </div>
              {s.status !== "APPROVED" && (
                <form action={reviewSeller} className="flex gap-2">
                  <input type="hidden" name="userId" value={s.userId} />
                  <button name="decision" value="approve" className="btn-primary py-2">Approve</button>
                  {s.status === "PENDING" && <button name="decision" value="reject" className="btn-outline py-2">Reject</button>}
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2 className="font-display text-2xl font-bold mt-12">Affiliates</h2>
      <p className="text-sm text-muted mt-1">Affiliates earn 2 points per ₦100 of orders through their links (coupons only, no cash).</p>
      {affiliates.length === 0 ? <p className="mt-4 text-muted">No affiliates yet.</p> : (
        <ul className="mt-4 space-y-3">
          {affiliates.map((a) => (
            <li key={a.userId} className="card p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm">
                <p className="font-bold text-base">{a.user.name ?? "No name yet"} <span className="ml-2 text-xs font-semibold text-muted">{a.status}</span></p>
                <p>{formatNgPhone(a.user.phone)} · code <span className="font-mono">{a.code}</span></p>
                <p className="text-muted">{a._count.clicks} clicks · {a._count.orders} orders</p>
              </div>
              {a.status !== "APPROVED" ? (
                <form action={reviewAffiliate} className="flex gap-2">
                  <input type="hidden" name="userId" value={a.userId} />
                  <button name="decision" value="approve" className="btn-primary py-2">Approve</button>
                  {a.status === "PENDING" && <button name="decision" value="reject" className="btn-outline py-2">Reject</button>}
                </form>
              ) : (
                <form action={reviewAffiliate}>
                  <input type="hidden" name="userId" value={a.userId} />
                  <button name="decision" value="reject" className="text-sm text-muted underline">Remove</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

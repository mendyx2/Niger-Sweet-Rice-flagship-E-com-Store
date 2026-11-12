import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { formatNgPhone } from "@/lib/phone";
import { OpsNav } from "../ops-nav";
import { reviewSeller } from "../actions";

export default function SellersPage() {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Sellers /></Suspense>;
}

async function Sellers() {
  await requireOps();
  const sellers = await db.sellerProfile.findMany({ include: { user: true }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200 });
  return (
    <>
      <OpsNav current="sellers" />
      <h1 className="font-display text-2xl font-bold">Seller applications</h1>
      <p className="text-sm text-muted mt-1">Approved sellers see wholesale prices (set them on the Prices page).</p>
      {sellers.length === 0 ? <p className="mt-6 text-muted">No applications yet.</p> : (
        <ul className="mt-6 space-y-3">
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
    </>
  );
}

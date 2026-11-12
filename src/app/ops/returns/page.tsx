import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { formatNgPhone } from "@/lib/phone";
import { OpsNav } from "../ops-nav";
import { ClaimReview } from "./claim-review";

const REASON: Record<string, string> = {
  TORN_BAG: "Torn / burst bag", TAMPERED: "Tampered", WATER_DAMAGED: "Water damaged", UNDERWEIGHT: "Underweight", WRONG_SIZE: "Wrong size",
};
const STATUS: Record<string, string> = {
  SUBMITTED: "New", UNDER_REVIEW: "Reviewing", APPROVED: "Approved", REPLACEMENT_SCHEDULED: "Replacement on the way", COMPLETED: "Completed", REJECTED: "Rejected",
};

const recentCutoff = () => new Date(Date.now() - 15 * 60_000);

export default function ReturnsPage({ searchParams }: PageProps<"/ops/returns">) {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Returns searchParams={searchParams} /></Suspense>;
}

async function Returns({ searchParams }: Pick<PageProps<"/ops/returns">, "searchParams">) {
  await requireOps();
  const showAll = (await searchParams).all === "1";
  const claims = await db.returnClaim.findMany({
    // Open claims, plus ones handled in the last 15 minutes so staff can see the outcome.
    where: showAll ? {} : { OR: [{ status: { in: ["SUBMITTED", "UNDER_REVIEW"] } }, { updatedAt: { gte: recentCutoff() } }] },
    orderBy: { createdAt: showAll ? "desc" : "asc" },
    take: 100,
    include: { order: { include: { items: true } }, photos: { select: { id: true } } },
  });
  const replacementNumbers = new Map(
    (await db.order.findMany({ where: { id: { in: claims.map((c) => c.replacementOrderId).filter((x): x is string => !!x) } }, select: { id: true, number: true } }))
      .map((o) => [o.id, o.number]),
  );

  return (
    <>
      <OpsNav current="returns" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Replacement requests</h1>
          <p className="text-sm text-muted mt-1">Approving creates a free replacement order and tells the rider to collect the damaged bag.</p>
        </div>
        <Link href={showAll ? "/ops/returns" : "/ops/returns?all=1"} className="text-sm underline">{showAll ? "Show open only" : "Show all"}</Link>
      </div>
      {claims.length === 0 ? <p className="mt-8 text-muted">No open requests.</p> : (
        <ul className="mt-6 space-y-4">
          {claims.map((c) => {
            const item = c.order.items.find((i) => i.id === c.orderItemId);
            return (
              <li key={c.id} className="card p-5">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-bold">{c.order.number}: {c.qty} × {item?.sizeKg}kg · {REASON[c.reason]}</p>
                    <p className="text-sm text-muted">
                      {c.order.customerName} · {formatNgPhone(c.order.contactPhone)} · submitted{" "}
                      {c.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{STATUS[c.status]}</span>
                </div>
                <p className="mt-3 rounded-lg bg-background p-3 text-sm">{c.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.photos.map((p, i) => (
                    <a key={p.id} href={`/api/claim-photos/${p.id}`} target="_blank" rel="noopener" className="block h-24 w-24 overflow-hidden rounded-lg border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element -- private, authenticated image */}
                      <img src={`/api/claim-photos/${p.id}`} alt={`Claim photo ${i + 1}`} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
                {c.resolutionNote && <p className="mt-3 text-sm text-muted">Note: {c.resolutionNote}</p>}
                {c.replacementOrderId && <p className="mt-1 text-sm">Replacement order: <strong>{replacementNumbers.get(c.replacementOrderId)}</strong></p>}
                {["SUBMITTED", "UNDER_REVIEW"].includes(c.status) && <ClaimReview claimId={c.id} />}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

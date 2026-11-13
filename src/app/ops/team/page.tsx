import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { formatNgPhone, normalizeNgPhone } from "@/lib/phone";
import { ActionForm } from "@/components/action-form";
import { OpsNav } from "../ops-nav";
import { addHqMember, removeHqMember } from "./actions";

export default function TeamPage() {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Team /></Suspense>;
}

const ACTION_LABEL: Record<string, string> = {
  "distributor.bank_change": "changed bank details", "hq.member_add": "added HQ member", "hq.member_remove": "removed HQ member",
  "order.status": "updated an order", "variant.update": "changed prices/stock", "restock.invoice": "invoiced a restock",
  "restock.paid": "confirmed a restock payment", "claim.approved": "approved a replacement", "claim.rejected": "rejected a replacement",
  "distributor.areas": "changed distributor areas", "hqfee.change": "changed the HQ fee", "promotion.create": "published a promotion",
  "distributor.create": "added a distributor", "distributor.update": "updated distributor details", "distributor.member_add": "added a distributor login",
  "distributor.member_remove": "removed a distributor login", "stock.adjust_approved": "approved a stock correction", "stock.adjust_rejected": "rejected a stock correction",
  "restock.cancel": "cancelled a restock", "zone.update": "changed HQ delivery fees", "promotion.pause": "paused a promotion", "promotion.resume": "resumed a promotion",
  "seller.approved": "approved a seller", "seller.rejected": "rejected a seller", "affiliate.approved": "approved an affiliate", "affiliate.rejected": "removed an affiliate",
  "alerts.hq_chat_remove": "removed an HQ Telegram chat", "payment.amount_mismatch": "flagged a payment mismatch",
};

async function Team() {
  const actor = await requireOps({ ownerOnly: true });
  const owners = new Set((process.env.HQ_OWNER_PHONES ?? "").split(",").map((p) => normalizeNgPhone(p.trim())).filter(Boolean));
  const [members, activity] = await Promise.all([
    db.user.findMany({ where: { roles: { hasSome: ["OWNER", "STAFF"] } }, orderBy: { createdAt: "asc" } }),
    db.auditLog.findMany({ where: { actor: { startsWith: "hq:" } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const names = new Map(members.map((m) => [`hq:${m.id}`, m.name ?? formatNgPhone(m.phone)]));
  return (
    <>
      <OpsNav current="team" />
      <h1 className="font-display text-2xl font-bold">HQ team</h1>
      <p className="mt-1 text-sm text-muted">Everyone signs in with their own phone number. <strong>Owners</strong> can also manage this team and change distributors&apos; bank details.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px] items-start">
        <div className="space-y-6">
          <ul className="card divide-y divide-border text-sm">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 p-4">
                <span>
                  <strong>{m.name ?? "No name"}</strong> · {formatNgPhone(m.phone)}
                  <span className="ml-2 text-xs text-muted">{m.roles.includes("OWNER") ? "Owner" : "Staff"}{owners.has(m.phone) ? " (set in site settings)" : ""}{actor === `hq:${m.id}` ? " · you" : ""}</span>
                </span>
                {actor !== `hq:${m.id}` && !owners.has(m.phone) && (
                  <form action={removeHqMember}><input type="hidden" name="userId" value={m.id} /><button className="text-danger underline">Remove</button></form>
                )}
              </li>
            ))}
          </ul>
          <section className="card p-5">
            <h2 className="font-semibold text-lg">Recent HQ activity</h2>
            {activity.length === 0 ? <p className="mt-2 text-sm text-muted">Nothing yet.</p> : (
              <ul className="mt-2 divide-y divide-border text-sm">
                {activity.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3 py-2">
                    <span><strong>{names.get(a.actor) ?? "Former staff"}</strong> {ACTION_LABEL[a.action] ?? a.action.replace(/[._]/g, " ")}</span>
                    <span className="shrink-0 text-xs text-muted">{a.createdAt.toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <section className="card p-5">
          <h2 className="font-semibold text-lg">Add someone</h2>
          <ActionForm action={addHqMember} submit="Give HQ access" className="mt-3 space-y-3 text-sm">
            <label className="block"><span className="font-semibold">Name</span><input name="name" required className="field" /></label>
            <label className="block"><span className="font-semibold">Mobile number</span><input name="phone" type="tel" required className="field" /></label>
            <label className="block"><span className="font-semibold">Role</span>
              <select name="role" className="field"><option value="STAFF">Staff</option><option value="OWNER">Owner</option></select>
            </label>
          </ActionForm>
        </section>
      </div>
    </>
  );
}

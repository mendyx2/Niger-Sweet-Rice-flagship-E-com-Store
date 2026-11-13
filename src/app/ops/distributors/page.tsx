import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { formatNgPhone } from "@/lib/phone";
import { ActionForm } from "@/components/action-form";
import { OpsNav } from "../ops-nav";
import { createDistributor, removeHqChat, setupTelegramBot, testHqAlert } from "./actions";
import { telegramLinks } from "@/lib/telegram-links";

export default function DistributorsPage() {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Distributors /></Suspense>;
}

async function Distributors() {
  await requireOps();
  const list = await db.distributor.findMany({
    orderBy: [{ isHq: "desc" }, { name: "asc" }],
    include: {
      zones: { select: { name: true } },
      stock: { include: { variant: { select: { sizeKg: true } } } },
      _count: { select: { members: true } },
      orders: { where: { status: "PENDING_PAYMENT", customerMarkedPaidAt: { not: null } }, select: { id: true } },
    },
  });
  const [hqChats, links] = await Promise.all([db.telegramChat.findMany({ where: { isHq: true } }), telegramLinks("hq")]);
  const pendingAdjustments = await db.stockMovement.groupBy({ by: ["distributorId"], where: { status: "PENDING_APPROVAL" }, _count: true });
  const adj = new Map(pendingAdjustments.map((a) => [a.distributorId, a._count]));

  return (
    <>
      <OpsNav current="distributors" />
      <h1 className="font-display text-2xl font-bold">Distributors</h1>
      <p className="text-sm text-muted mt-1">
        Each area has one distributor. Areas without one, and orders a distributor can&apos;t fill, go to HQ.
        A distributor takes orders once it is active, has bank details, areas and prices.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px] items-start">
        <ul className="space-y-3">
          {list.map((d) => {
            const missing = [
              !(d.bankName && d.accountNumber) && "bank details",
              !d.isHq && d.zones.length === 0 && "areas",
              !d.isHq && d._count.members === 0 && "a login",
            ].filter(Boolean);
            return (
              <li key={d.id}>
                <Link href={`/ops/distributors/${d.id}`} className="card block p-5 hover:border-brand">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-lg">{d.name} {d.isHq && <span className="ml-1 rounded-full bg-brand px-2 py-0.5 text-xs text-white">HQ</span>}</p>
                      <p className="text-sm text-muted">{[d.address, d.phone && formatNgPhone(d.phone)].filter(Boolean).join(" · ") || "No contact details yet"}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${d.status === "ACTIVE" ? "bg-success/15 text-success" : "bg-promo-soft text-danger"}`}>
                      {d.status === "ACTIVE" ? "Active" : "Suspended"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="text-muted">Areas:</span> {d.isHq ? "all (fallback)" : d.zones.map((z) => z.name).join(", ") || "none yet"}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="text-muted">Stock:</span>{" "}
                    {d.stock.sort((a, b) => b.variant.sizeKg - a.variant.sizeKg).map((s) => `${s.onHand}×${s.variant.sizeKg}kg${s.inTransit ? ` (+${s.inTransit} in transit)` : ""}`).join(" · ")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {missing.length > 0 && <span className="rounded-full bg-cta/30 px-2 py-0.5 font-semibold">Needs {missing.join(", ")}</span>}
                    {d.orders.length > 0 && <span className="rounded-full bg-promo-soft px-2 py-0.5 font-semibold text-danger">{d.orders.length} payment(s) to confirm</span>}
                    {adj.get(d.id) ? <span className="rounded-full bg-promo-soft px-2 py-0.5 font-semibold text-danger">{adj.get(d.id)} stock change(s) to approve</span> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="space-y-6">
        <section className="card p-5">
          <h2 className="font-semibold text-lg">HQ alerts</h2>
          <p className="mt-1 text-sm text-muted">Payments waiting too long, stock requests, delivery shortfalls and damage reports. Free on Telegram and/or email.</p>
          {hqChats.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {hqChats.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-brand-soft px-3 py-2">
                  <span>✓ Telegram{c.title ? `: ${c.title}` : ""}</span>
                  <form action={removeHqChat}><input type="hidden" name="id" value={c.id} /><button className="text-xs underline">Remove</button></form>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-danger">No HQ Telegram chat connected.</p>}
          {links && (
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <a href={links.personal} target="_blank" rel="noopener noreferrer" className="btn-cta py-2">Connect my Telegram</a>
              <a href={links.group} target="_blank" rel="noopener noreferrer" className="btn-outline py-2">Add to a staff group</a>
            </div>
          )}
          <p className="mt-3 text-sm">{process.env.OPS_ALERT_EMAIL ? <>Email: <strong>{process.env.OPS_ALERT_EMAIL}</strong></> : <span className="text-muted">No HQ alert email (set OPS_ALERT_EMAIL).</span>}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <ActionForm action={testHqAlert} submit="Send test alert" buttonClass="btn-outline py-2 text-sm" />
            <ActionForm action={setupTelegramBot} submit="Connect bot to site" buttonClass="rounded-full border border-border px-4 py-2 text-sm" />
          </div>
          <p className="mt-2 text-xs text-muted">&ldquo;Connect bot to site&rdquo; is needed once, after the site is live and the bot token is added.</p>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold text-lg">Add a distributor</h2>
          <ActionForm action={createDistributor} submit="Add distributor" className="mt-3 space-y-3 text-sm">
            <label className="block"><span className="font-semibold">Business name</span><input name="name" required className="field" /></label>
            <label className="block"><span className="font-semibold">Phone</span><input name="phone" type="tel" className="field" /></label>
            <label className="block"><span className="font-semibold">Address</span><input name="address" className="field" /></label>
            <label className="block"><span className="font-semibold">Opening hours</span><input name="hours" placeholder="Mon–Sat, 8am–6pm" className="field" /></label>
          </ActionForm>
        </section>
        </div>
      </div>
    </>
  );
}

import { Suspense } from "react";
import { db } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { telegramLinks } from "@/lib/telegram-links";
import { isEmailConfigured } from "@/lib/email";
import { ActionForm } from "@/components/action-form";
import { PartnerNav } from "../partner-nav";
import { disconnectTelegram, saveAlertEmail, sendTestAlert } from "../actions";

export default function AlertsPage() {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Alerts /></Suspense>;
}

async function Alerts() {
  const { distributor, member, user } = await requirePartner({ next: "/partner/alerts" });
  const [mine, teamCount, links] = await Promise.all([
    db.telegramChat.findMany({ where: { userId: user.id } }),
    db.telegramChat.count({ where: { user: { distributorMember: { distributorId: distributor.id } } } }),
    telegramLinks({ userId: user.id }),
  ]);
  const isOwner = member.role === "OWNER";

  return (
    <>
      <PartnerNav current="alerts" name={distributor.name} isOwner={isOwner} />
      <h1 className="font-display text-2xl font-bold">Alerts</h1>
      <p className="mt-1 text-sm text-muted">
        Get told straight away about new orders, customers saying they&apos;ve paid, invoices and stock deliveries, free on Telegram and/or by email.
        {teamCount + (distributor.alertEmail ? 1 : 0) === 0 && <strong className="block mt-1 text-danger">Nothing is connected yet, so your team won&apos;t get new-order alerts.</strong>}
      </p>

      <section className="mt-6 card p-5">
        <h2 className="font-semibold text-lg">Telegram (on your phone)</h2>
        {mine.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {mine.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-brand-soft px-3 py-2">
                <span>✓ Connected{c.title ? ` (${c.title})` : ""}</span>
                <form action={disconnectTelegram}><input type="hidden" name="id" value={c.id} /><button className="text-xs underline">Disconnect</button></form>
              </li>
            ))}
          </ul>
        ) : links ? (
          <>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
              <li>Install Telegram if you don&apos;t have it.</li>
              <li>Tap the button below; it opens our bot in Telegram.</li>
              <li>Tap <strong>Start</strong>. You&apos;ll get a &ldquo;connected&rdquo; message.</li>
            </ol>
            <a href={links.personal} target="_blank" rel="noopener noreferrer" className="btn-cta mt-4">Connect Telegram</a>
            <p className="mt-2 text-xs text-muted">The link works for 1 hour and only for you. Reload this page after connecting.</p>
            {!links.live && <p className="mt-2 text-xs text-danger">Development mode: no real bot yet. In development, alerts are printed in the server log.</p>}
          </>
        ) : <p className="mt-2 text-sm text-muted">Telegram alerts aren&apos;t set up yet. HQ needs to finish setting up the bot.</p>}
        <p className="mt-3 text-xs text-muted">{teamCount} Telegram chat{teamCount === 1 ? "" : "s"} connected across your team.</p>
      </section>

      <section className="mt-6 card p-5">
        <h2 className="font-semibold text-lg">Email</h2>
        {isOwner ? (
          <ActionForm action={saveAlertEmail} submit="Save email" className="mt-3 space-y-3 text-sm">
            <label className="block max-w-sm"><span className="font-semibold">Send alerts to</span>
              <input name="alertEmail" type="email" defaultValue={distributor.alertEmail ?? ""} placeholder="orders@yourbusiness.com" className="field" /></label>
          </ActionForm>
        ) : <p className="mt-2 text-sm">{distributor.alertEmail ? `Alerts are emailed to ${distributor.alertEmail}.` : "No alert email set. Ask your owner to add one."}</p>}
        {!isEmailConfigured() && <p className="mt-2 text-xs text-muted">Email sending isn&apos;t switched on yet at HQ; emails will start once it is.</p>}
      </section>

      <section className="mt-6 card p-5">
        <h2 className="font-semibold text-lg">Check it works</h2>
        <ActionForm action={sendTestAlert} submit="Send a test alert" buttonClass="btn-outline py-2" className="mt-3" />
      </section>
    </>
  );
}

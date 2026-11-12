"use client";

import { useActionState } from "react";
import { applyAsSeller, deleteAccount, redeem, updateProfile } from "./actions";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold">Full name</span>
        <input name="name" defaultValue={name} required autoComplete="name" className="field" />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Email <span className="font-normal text-muted">(optional, for receipts)</span></span>
        <input name="email" type="email" defaultValue={email} autoComplete="email" className="field" />
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary py-2.5">{pending ? "Saving…" : "Save"}</button>
        {state && <p role="status" className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
      </div>
    </form>
  );
}

export function SellerForm({ name, defaults }: { name: string; defaults?: { businessName: string; cacNumber: string | null; address: string } }) {
  const [state, action, pending] = useActionState(applyAsSeller, null);
  if (state?.ok) return <p role="status" className="rounded-xl bg-brand-soft p-4 text-brand font-medium">{state.message}</p>;
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold">Your name</span>
        <input name="name" defaultValue={name} required autoComplete="name" className="field" />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Business name</span>
        <input name="businessName" defaultValue={defaults?.businessName} required autoComplete="organization" className="field" />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">CAC registration number <span className="font-normal text-muted">(optional)</span></span>
        <input name="cacNumber" defaultValue={defaults?.cacNumber ?? ""} className="field" />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Shop / business address</span>
        <textarea name="address" defaultValue={defaults?.address} required rows={3} autoComplete="street-address" className="field" />
      </label>
      {state && !state.ok && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      <button disabled={pending} className="btn-cta w-full">{pending ? "Sending…" : "Apply to sell"}</button>
    </form>
  );
}

export function RedeemForm({ tiers, balance }: { tiers: { points: number; label: string; minOrder: string }[]; balance: number }) {
  const [state, action, pending] = useActionState(redeem, null);
  return (
    <form action={action}>
      <ul className="grid gap-3 sm:grid-cols-3">
        {tiers.map((t) => {
          const affordable = balance >= t.points;
          return (
            <li key={t.points} className={`rounded-2xl border p-4 ${affordable ? "border-brand bg-surface" : "border-border bg-background"}`}>
              <p className="font-display text-2xl font-bold text-brand">{t.label}</p>
              <p className="text-sm text-muted">{t.points.toLocaleString("en-NG")} points · orders over {t.minOrder}</p>
              <button name="points" value={t.points} disabled={!affordable || pending}
                className={`mt-3 w-full ${affordable ? "btn-cta py-2" : "rounded-full border border-border py-2 text-sm text-muted"}`}>
                {affordable ? "Get coupon" : `${(t.points - balance).toLocaleString("en-NG")} more points`}
              </button>
            </li>
          );
        })}
      </ul>
      {state && <p role="status" className={`mt-3 text-sm font-medium ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, null);
  return (
    <form action={action} className="mt-4 space-y-3">
      <p className="text-sm text-muted">
        This removes your phone number, name, email, addresses, unused coupons, points and replacement photos. Order records stay on file for
        tax purposes but are no longer linked to you. This can&apos;t be undone.
      </p>
      <label className="block text-sm">
        <span className="font-semibold">Type DELETE to confirm</span>
        <input name="confirm" autoComplete="off" className="field max-w-xs" />
      </label>
      {state && !state.ok && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      <button disabled={pending} className="rounded-full border border-danger px-5 py-2 text-sm font-semibold text-danger hover:bg-promo-soft">
        {pending ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}

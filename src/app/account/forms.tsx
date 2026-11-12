"use client";

import { useActionState } from "react";
import { applyAsSeller, updateProfile } from "./actions";

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

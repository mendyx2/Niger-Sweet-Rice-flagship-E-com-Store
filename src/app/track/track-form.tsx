"use client";

import { useActionState, useState } from "react";
import { OrderTimeline } from "@/components/order-timeline";
import { StatusPill } from "@/components/order-status";
import { trackOrder, type TrackResult } from "./actions";

export function TrackForm() {
  const [state, action, pending] = useActionState<TrackResult, FormData>(trackOrder, null);
  // Controlled so the fields keep their values after a lookup.
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <>
      <form action={action} className="mt-6 card p-5 sm:p-6 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold">Order number</span>
          <input name="number" required value={number} onChange={(e) => setNumber(e.target.value)} placeholder="NSR-XXXXXX" autoCapitalize="characters" className="field uppercase" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Phone number</span>
          <input name="phone" type="tel" inputMode="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0801 234 5678" autoComplete="tel-national" className="field" />
        </label>
        {state && !state.ok && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        <button disabled={pending} className="btn-cta w-full">{pending ? "Looking up…" : "Track order"}</button>
      </form>
      {state?.ok && !pending && (
        <section className="mt-6 card p-6" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold">{state.number}</h2>
            <StatusPill status={state.status} />
          </div>
          <p className="mt-1 text-sm text-muted">{state.items}</p>
          <div className="mt-6"><OrderTimeline status={state.status} events={state.events} isPickup={state.isPickup} /></div>
          {state.riderName && <p className="mt-6 rounded-xl bg-brand-soft p-3 text-sm">Your rider today: <strong>{state.riderName}</strong></p>}
        </section>
      )}
    </>
  );
}

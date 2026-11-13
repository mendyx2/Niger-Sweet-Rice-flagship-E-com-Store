"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { formatNaira } from "@/lib/money";
import { ZoneSelect, type ZoneOption } from "@/components/zone-select";
import { getSampleQuote, requestSample, type SampleState } from "./actions";
import { track } from "@/lib/analytics";

export function SampleForm({ zones, defaults }: {
  zones: ZoneOption[];
  defaults: { name: string; phone: string };
}) {
  const [zoneId, setZoneId] = useState("");
  const [state, action, pending] = useActionState<SampleState, FormData>(requestSample, null);
  useEffect(() => {
    if (!state?.ok) return;
    track("generate_lead");
    window.location.assign(state.url);
  }, [state]);

  const zone = zones.find((z) => z.id === zoneId);
  const isPickup = zone?.kind === "PICKUP";
  // The fee comes from whoever will send the sample (the area's distributor or HQ), checked on the server.
  const [quote, setQuote] = useState<{ zoneId: string; data: Awaited<ReturnType<typeof getSampleQuote>> } | null>(null);
  const [, startTransition] = useTransition();
  useEffect(() => {
    if (!zoneId) return;
    startTransition(async () => setQuote({ zoneId, data: await getSampleQuote(zoneId) }));
  }, [zoneId]);
  const q = quote && quote.zoneId === zoneId ? quote.data : undefined;
  const fee = q?.feeKobo;
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-semibold">Full name</span>
        <input name="name" required defaultValue={defaults.name} autoComplete="name" className="field" />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Phone</span>
        <input name="phone" type="tel" required defaultValue={defaults.phone} autoComplete="tel-national" className="field" />
      </label>
      <div>
        <label htmlFor="zone" className="text-sm font-semibold">Pickup or delivery area</label>
        <ZoneSelect zones={zones} value={zoneId} onChange={setZoneId} name="zoneId" required />
      </div>
      {zone && !isPickup && (
        <>
          <label className="block">
            <span className="text-sm font-semibold">Street address</span>
            <textarea name="street" rows={2} required autoComplete="street-address" className="field" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Nearest landmark</span>
            <input name="landmark" className="field" />
          </label>
        </>
      )}
      {zone && q !== undefined && (
        q ? (
          <div className="rounded-xl bg-background p-4">
            <div className="flex justify-between">
              <span>1kg sample <span className="text-muted">(free)</span> + {isPickup ? "pickup" : "delivery"}</span>
              <strong>{q.feeKobo === 0 ? "Free" : formatNaira(q.feeKobo)}</strong>
            </div>
            <p className="mt-1 text-xs text-muted">Sent by {q.seller}</p>
          </div>
        ) : <p className="rounded-xl bg-promo-soft p-3 text-sm">Free samples aren&apos;t available for this area right now.</p>
      )}
      {state && !state.ok && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending || state?.ok === true || (!!zone && !q)} className="btn-cta w-full">
        {pending ? "Requesting…" : !zone || fee === undefined ? "Request free sample" : fee === 0 ? "Get my free sample" : `Pay ${formatNaira(fee)} delivery`}
      </button>
    </form>
  );
}

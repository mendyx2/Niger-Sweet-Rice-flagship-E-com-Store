"use client";

import { useActionState, useEffect, useState } from "react";
import { formatNaira } from "@/lib/money";
import { ZoneSelect, type ZoneOption } from "@/components/zone-select";
import { requestSample, type SampleState } from "./actions";
import { track } from "@/lib/analytics";

export function SampleForm({ zones, defaults }: {
  zones: (ZoneOption & { fee: number })[];
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
      {zone && (
        <div className="flex justify-between rounded-xl bg-background p-4">
          <span>1kg sample <span className="text-muted">(free)</span> + {isPickup ? "pickup" : "delivery"}</span>
          <strong>{zone.fee === 0 ? "Free" : formatNaira(zone.fee)}</strong>
        </div>
      )}
      {state && !state.ok && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending || state?.ok === true} className="btn-cta w-full">
        {pending ? "Requesting…" : !zone ? "Request free sample" : zone.fee === 0 ? "Get my free sample" : `Pay ${formatNaira(zone.fee)} delivery`}
      </button>
    </form>
  );
}

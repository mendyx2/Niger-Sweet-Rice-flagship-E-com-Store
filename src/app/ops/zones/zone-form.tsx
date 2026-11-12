"use client";

import { useActionState } from "react";
import { koboToNairaInput } from "@/lib/money";
import { updateZones } from "../actions";

type Zone = {
  id: string; name: string; kind: "PICKUP" | "ABUJA" | "NEARBY_TOWN"; baseFeeKobo: number; perKgFeeKobo: number;
  minOrderKg: number | null; minOrderKobo: number | null; terms: string | null; active: boolean;
};

const input = "w-24 rounded-lg border border-border bg-surface px-2 py-1.5 text-right";
const KIND = { PICKUP: "Pickup", ABUJA: "Abuja", NEARBY_TOWN: "Nearby town" };

export function ZoneForm({ zones }: { zones: Zone[] }) {
  const [state, action, pending] = useActionState(updateZones, null);
  return (
    <form action={action} className="mt-4">
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="p-3">Area</th>
              <th className="p-3">Base fee ₦</th>
              <th className="p-3">Per kg ₦</th>
              <th className="p-3">Min kg</th>
              <th className="p-3">Min order ₦</th>
              <th className="p-3">Terms shown to buyer</th>
              <th className="p-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id} className="border-t border-border">
                <td className="p-3 font-semibold whitespace-nowrap">
                  {z.name}<span className="block text-xs font-normal text-muted">{KIND[z.kind]}</span>
                </td>
                <td className="p-3"><input aria-label={`${z.name} base fee`} name={`baseFee:${z.id}`} inputMode="decimal" defaultValue={koboToNairaInput(z.baseFeeKobo)} className={input} /></td>
                <td className="p-3"><input aria-label={`${z.name} per kg fee`} name={`perKgFee:${z.id}`} inputMode="decimal" defaultValue={koboToNairaInput(z.perKgFeeKobo)} className={input} /></td>
                <td className="p-3"><input aria-label={`${z.name} minimum kg`} name={`minOrderKg:${z.id}`} inputMode="numeric" defaultValue={z.minOrderKg ?? ""} className={input} /></td>
                <td className="p-3"><input aria-label={`${z.name} minimum order`} name={`minOrder:${z.id}`} inputMode="decimal" defaultValue={koboToNairaInput(z.minOrderKobo)} className={input} /></td>
                <td className="p-3"><input aria-label={`${z.name} terms`} name={`terms:${z.id}`} defaultValue={z.terms ?? ""} maxLength={300} className="w-64 rounded-lg border border-border bg-surface px-2 py-1.5" /></td>
                <td className="p-3"><input aria-label={`${z.name} active`} type="checkbox" name={`active:${z.id}`} defaultChecked={z.active} className="h-5 w-5 accent-[var(--brand)]" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <button disabled={pending} className="rounded-full bg-brand px-6 py-2.5 font-semibold text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save zones"}
        </button>
        {state && <p role="status" className={`text-sm ${state.ok ? "text-brand" : "text-danger"}`}>{state.message}</p>}
      </div>
    </form>
  );
}

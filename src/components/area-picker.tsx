"use client";

import { useEffect, useRef, useState } from "react";
import { setZone, useZone } from "@/lib/zone-store";
import { ZoneSelect, type ZoneOption } from "./zone-select";

/** "Deliver to: Gwarinpa ▾" in the header. Prices and stock on the site follow this area. */
export function AreaPicker({ zones }: { zones: ZoneOption[] }) {
  const zoneId = useZone();
  const zone = zones.find((z) => z.id === zoneId);
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const open = () => {
      setDraft(zoneId);
      dialog.current?.showModal();
    };
    window.addEventListener("nsr-open-area-picker", open);
    return () => window.removeEventListener("nsr-open-area-picker", open);
  }, [zoneId]);

  return (
    <>
      <button
        type="button"
        onClick={() => { setDraft(zoneId); dialog.current?.showModal(); }}
        className="inline-flex max-w-[7.5rem] sm:max-w-[11rem] items-center gap-1 rounded-full px-2 sm:px-3 py-1.5 text-sm hover:bg-brand-soft"
        aria-label={zone ? `Delivering to ${zone.name}. Change area` : "Choose your delivery area"}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
        </svg>
        <span className="hidden truncate min-[360px]:block">{zone ? zone.name : <><span className="sm:hidden">Area</span><span className="hidden sm:inline">Choose area</span></>}</span>
      </button>
      <dialog ref={dialog} className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-border bg-surface p-0 backdrop:bg-black/40">
        <form
          method="dialog"
          className="p-5"
          onSubmit={() => { if (draft) setZone(draft); }}
        >
          <h2 className="font-display text-xl font-bold">Where should we deliver?</h2>
          <p className="mt-1 text-sm text-muted">Prices, stock and delivery fees come from the seller who covers your area.</p>
          <label htmlFor="area-picker" className="sr-only">Delivery area</label>
          <ZoneSelect id="area-picker" zones={zones} value={draft} onChange={setDraft} />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-background">Cancel</button>
            <button disabled={!draft} className="btn-cta py-2">Save area</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

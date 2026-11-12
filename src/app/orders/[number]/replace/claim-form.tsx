"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { submitClaim, type ClaimState } from "./actions";

const REASONS = [
  ["TORN_BAG", "Bag is torn or burst"],
  ["TAMPERED", "Bag looks opened or tampered with"],
  ["WATER_DAMAGED", "Rice is wet or water-damaged"],
  ["UNDERWEIGHT", "Bag is underweight"],
  ["WRONG_SIZE", "Wrong bag size delivered"],
] as const;

/** Shrinks phone photos in the browser (max 1600px, JPEG) so uploads are fast on mobile data. */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/heic" || file.type === "image/heif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function ClaimForm({ number, items }: { number: string; items: { id: string; label: string; qty: number }[] }) {
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [itemId, setItemId] = useState(items.length === 1 ? items[0].id : "");
  const [state, action, pending] = useActionState<ClaimState, FormData>(async (prev, fd) => {
    fd.delete("photos");
    for (const p of photos) fd.append("photos", p.file);
    return submitClaim(prev, fd);
  }, null);

  if (state?.ok) {
    return (
      <div role="status" className="text-center">
        <p className="text-lg font-semibold text-brand">{state.message}</p>
        <Link href={`/orders/${number}`} className="btn-primary mt-5">Back to order</Link>
      </div>
    );
  }

  const item = items.find((i) => i.id === itemId);
  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const added = await Promise.all([...list].slice(0, 5 - photos.length).map(shrink));
    setPhotos((p) => [...p, ...added.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 5));
  };

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="number" value={number} />
      <label className="block">
        <span className="text-sm font-semibold">Which bag?</span>
        <select name="orderItemId" required value={itemId} onChange={(e) => setItemId(e.target.value)} className="field">
          <option value="">Choose…</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.label}{i.qty > 1 ? ` (you ordered ${i.qty})` : ""}</option>)}
        </select>
      </label>
      {item && item.qty > 1 && (
        <label className="block">
          <span className="text-sm font-semibold">How many bags are affected?</span>
          <input name="qty" type="number" min={1} max={item.qty} defaultValue={1} className="field w-28" />
        </label>
      )}
      {(!item || item.qty === 1) && <input type="hidden" name="qty" value="1" />}

      <fieldset>
        <legend className="text-sm font-semibold">What&apos;s wrong?</legend>
        <div className="mt-2 space-y-2">
          {REASONS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
              <input type="radio" name="reason" value={value} required className="h-4 w-4 accent-[var(--brand)]" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-semibold">Tell us more</span>
        <textarea name="description" rows={3} required minLength={10} placeholder="e.g. The 25kg bag had a long tear at the bottom when it arrived." className="field" />
      </label>

      <div>
        <p className="text-sm font-semibold">Photos <span className="font-normal text-muted">(1 to 5: show the bag and the problem)</span></p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((p, i) => (
            <div key={p.url} className="relative aspect-square overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a just-picked file */}
              <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotos((list) => list.filter((x) => x !== p))}
                className="absolute right-1 top-1 h-7 w-7 rounded-full bg-foreground/70 text-white">×</button>
            </div>
          ))}
          {photos.length < 5 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-center text-sm text-muted hover:border-brand">
              <span className="text-2xl" aria-hidden="true">+</span>
              Add photo
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>
      </div>

      {state && !state.ok && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      <button disabled={pending || photos.length === 0} className="btn-cta w-full">{pending ? "Sending…" : "Request replacement"}</button>
      <p className="text-xs text-muted text-center">We collect the damaged bag and deliver the replacement at no cost to you.</p>
    </form>
  );
}

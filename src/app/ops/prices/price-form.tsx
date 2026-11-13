"use client";

import { useActionState } from "react";
import { koboToNairaInput } from "@/lib/money";
import { updatePrices } from "../actions";

type Row = {
  id: string; sizeKg: number; sku: string; retailPriceKobo: number | null; wholesalePriceKobo: number | null;
  compareAtPriceKobo: number | null; stockQty: number; reservedQty: number; active: boolean;
  minRetailKobo: number | null; maxRetailKobo: number | null; hqFeeKobo: number;
};

const input = "w-28 rounded-lg border border-border bg-surface px-2 py-1.5 text-right";

export function PriceForm({ variants }: { variants: Row[] }) {
  const [state, action, pending] = useActionState(updatePrices, null);
  return (
    <form action={action} className="mt-3">
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="p-3">Bag</th>
              <th className="p-3">Retail ₦</th>
              <th className="p-3">Wholesale ₦ <span className="font-normal">(sellers)</span></th>
              <th className="p-3">&ldquo;Was&rdquo; ₦ <span className="font-normal">(promo)</span></th>
              <th className="p-3">Distributor range ₦</th>
              <th className="p-3">HQ fee / bag ₦</th>
              <th className="p-3">HQ stock (bags)</th>
              <th className="p-3">On sale</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.id} className="border-t border-border">
                <td className="p-3 font-semibold whitespace-nowrap">
                  {v.sizeKg}kg <span className="block text-xs font-normal text-muted">{v.sku}</span>
                </td>
                <td className="p-3">
                  <input aria-label={`${v.sizeKg}kg retail price`} name={`retailPriceKobo:${v.id}`} inputMode="decimal"
                    defaultValue={koboToNairaInput(v.retailPriceKobo)} placeholder="e.g. 85000" className={input} />
                </td>
                <td className="p-3">
                  <input aria-label={`${v.sizeKg}kg wholesale price`} name={`wholesalePriceKobo:${v.id}`} inputMode="decimal"
                    defaultValue={koboToNairaInput(v.wholesalePriceKobo)} className={input} />
                </td>
                <td className="p-3">
                  <input aria-label={`${v.sizeKg}kg was price`} name={`compareAtPriceKobo:${v.id}`} inputMode="decimal"
                    defaultValue={koboToNairaInput(v.compareAtPriceKobo)} className={input} />
                </td>
                <td className="p-3 whitespace-nowrap">
                  <input aria-label={`${v.sizeKg}kg lowest distributor price`} name={`minRetailKobo:${v.id}`} inputMode="decimal"
                    defaultValue={koboToNairaInput(v.minRetailKobo)} placeholder="min" className={input} />
                  <span className="mx-1 text-muted">–</span>
                  <input aria-label={`${v.sizeKg}kg highest distributor price`} name={`maxRetailKobo:${v.id}`} inputMode="decimal"
                    defaultValue={koboToNairaInput(v.maxRetailKobo)} placeholder="max" className={input} />
                </td>
                <td className="p-3">
                  <input aria-label={`${v.sizeKg}kg HQ fee per bag`} name={`hqFee:${v.id}`} inputMode="decimal"
                    defaultValue={koboToNairaInput(v.hqFeeKobo)} className={input} />
                </td>
                <td className="p-3">
                  <input aria-label={`${v.sizeKg}kg stock`} name={`stockQty:${v.id}`} inputMode="numeric"
                    defaultValue={v.stockQty} className={input} />
                  {v.reservedQty > 0 && <span className="block text-xs text-muted">{v.reservedQty} reserved</span>}
                </td>
                <td className="p-3">
                  <input aria-label={`${v.sizeKg}kg on sale`} type="checkbox" name={`active:${v.id}`} defaultChecked={v.active}
                    className="h-5 w-5 accent-[var(--brand)]" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <button disabled={pending} className="rounded-full bg-brand px-6 py-2.5 font-semibold text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save prices"}
        </button>
        {state && (
          <p role="status" className={`text-sm ${state.ok ? "text-brand" : "text-danger"}`}>{state.message}</p>
        )}
      </div>
    </form>
  );
}

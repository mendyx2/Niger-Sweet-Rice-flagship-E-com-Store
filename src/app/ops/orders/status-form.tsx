"use client";

import { useActionState, useState } from "react";
import { updateOrderStatus } from "../actions";

export function StatusForm({ orderId, options, rider }: {
  orderId: string; options: { value: string; label: string }[]; rider: { name: string; phone: string };
}) {
  const [state, action, pending] = useActionState(updateOrderStatus, null);
  const [status, setStatus] = useState(options[0]?.value ?? "");
  return (
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4"
      onSubmit={(e) => { if (status === "CANCELLED" && !confirm("Cancel this order? Paid orders must be refunded in Paystack.")) e.preventDefault(); }}>
      <input type="hidden" name="orderId" value={orderId} />
      <label className="text-sm">
        <span className="block font-semibold">Move to</span>
        <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="field mt-1 py-2">
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      {status === "OUT_FOR_DELIVERY" && (
        <>
          <label className="text-sm"><span className="block font-semibold">Rider name</span><input name="riderName" defaultValue={rider.name} className="field mt-1 py-2" /></label>
          <label className="text-sm"><span className="block font-semibold">Rider phone</span><input name="riderPhone" defaultValue={rider.phone} className="field mt-1 py-2" /></label>
        </>
      )}
      <label className="text-sm flex-1 min-w-40"><span className="block font-semibold">Note (optional)</span><input name="note" className="field mt-1 py-2" /></label>
      <button disabled={pending} className="btn-primary py-2.5">{pending ? "Saving…" : "Update & notify"}</button>
      {state && <p role="status" className={`w-full text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
    </form>
  );
}

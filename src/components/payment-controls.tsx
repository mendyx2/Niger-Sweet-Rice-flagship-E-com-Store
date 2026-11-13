"use client";

import { ActionForm } from "./action-form";

type Action = (prev: { ok: boolean; message: string } | null, fd: FormData) => Promise<{ ok: boolean; message: string } | null>;

/** "Payment received" / "Not received yet" for a bank-transfer order. */
export function PaymentControls({ orderId, action, customerSaysPaid }: { orderId: string; action: Action; customerSaysPaid: boolean }) {
  return (
    <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3">
      <ActionForm action={action} submit="Payment received" buttonClass="btn-cta py-2"
        confirm="Only confirm once the money is in the bank account. Confirm payment received?">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="decision" value="received" />
      </ActionForm>
      {customerSaysPaid && (
        <ActionForm action={action} submit="Not received yet" buttonClass="rounded-full border border-border px-4 py-2 text-sm font-semibold">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="decision" value="not_received" />
        </ActionForm>
      )}
    </div>
  );
}

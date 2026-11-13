"use client";

import { useEffect, useState, useTransition } from "react";
import { cart } from "@/lib/cart-store";
import { track } from "@/lib/analytics";
import { formatNaira } from "@/lib/money";
import { markTransferSent } from "../../checkout/actions";

/** Empties the cart once the order is placed, and records the purchase once it's paid (each only once per order). */
export function OrderEffects({ number, paid, totalKobo, items }: {
  number: string; paid: boolean; totalKobo: number; items: { sku: string; sizeKg: number; priceKobo: number; qty: number }[];
}) {
  useEffect(() => {
    const once = (key: string) => {
      try {
        if (localStorage.getItem(key)) return false;
        localStorage.setItem(key, "1");
      } catch {}
      return true;
    };
    if (once(`nsr_cleared_${number}`)) cart.clear();
    if (paid && once(`nsr_purchase_${number}`)) {
      track("purchase", {
        transactionId: number,
        valueKobo: totalKobo,
        items: items.map((i) => ({ item_id: i.sku, item_name: "Rice", item_variant: `${i.sizeKg}kg`, price: i.priceKobo / 100, quantity: i.qty })),
      });
    }
  }, [number, paid, totalKobo, items]);
  return null;
}

function Copy({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label={`Copy ${label}`}
      onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch {} }}
      className="shrink-0 rounded-full border border-brand px-3 py-1 text-xs font-semibold text-brand hover:bg-brand-soft">
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/** Bank transfer instructions with the seller's account, the exact amount and the narration. */
export function TransferPanel({ number, amountKobo, payTo, deadline, markedPaid }: {
  number: string;
  amountKobo: number;
  payTo: { distributorName?: string; bankName?: string | null; accountNumber?: string | null; accountName?: string | null };
  deadline: string | null;
  markedPaid: boolean;
}) {
  const [sent, setSent] = useState(markedPaid);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const rows: [string, string, boolean][] = [
    ["Amount", formatNaira(amountKobo), true],
    ["Bank", payTo.bankName ?? "", false],
    ["Account number", payTo.accountNumber ?? "", true],
    ["Account name", payTo.accountName ?? "", false],
    ["Narration / reference", number, true],
  ];
  const deadlineLabel = deadline
    ? new Date(deadline).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" })
    : null;

  return (
    <section className="mt-6 rounded-3xl border-2 border-cta bg-surface p-5 sm:p-6" aria-labelledby="pay-title">
      <h2 id="pay-title" className="font-display text-2xl font-bold">
        {sent ? "Waiting for the seller to confirm your payment" : "Pay by bank transfer"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {sent
          ? `${payTo.distributorName ?? "The seller"} will confirm as soon as the money shows in their account. We'll text you.`
          : <>Transfer the exact amount to <strong>{payTo.distributorName}</strong>{deadlineLabel ? <> by <strong>{deadlineLabel}</strong></> : null}, then tap the button below.</>}
      </p>
      <dl className="mt-4 divide-y divide-border rounded-2xl bg-background">
        {rows.map(([k, v, copy]) => (
          <div key={k} className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="flex items-center gap-2 text-right font-semibold tabular-nums">
              <span className={k === "Account number" ? "text-lg tracking-wider" : ""}>{v}</span>
              {copy && <Copy value={k === "Amount" ? String(amountKobo / 100) : v} label={k} />}
            </dd>
          </div>
        ))}
      </dl>
      {!sent && (
        <button type="button" disabled={pending} className="btn-cta mt-5 w-full text-lg"
          onClick={() => start(async () => {
            const r = await markTransferSent(number);
            setMsg(r.message);
            if (r.ok) setSent(true);
          })}>
          {pending ? "Sending…" : "I've made the transfer"}
        </button>
      )}
      {msg && <p role="status" className="mt-3 text-sm text-brand">{msg}</p>}
      <p className="mt-3 text-xs text-muted">
        Only pay into the account shown here. Naija Sweet Rice and its distributors will never ask you to pay into a different account by phone or WhatsApp.
      </p>
    </section>
  );
}

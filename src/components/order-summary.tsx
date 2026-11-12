import { formatNaira } from "@/lib/money";
import type { Quote } from "@/lib/pricing";

export function OrderSummary({
  quote, subtotalKobo, zoneChosen, isPickup,
}: { quote: Quote | null; subtotalKobo: number; zoneChosen: boolean; isPickup?: boolean }) {
  const row = "flex justify-between gap-4";
  return (
    <dl className="space-y-2 text-sm">
      <div className={row}><dt className="text-muted">Subtotal</dt><dd className="font-medium tabular-nums">{formatNaira(quote?.subtotalKobo ?? subtotalKobo)}</dd></div>
      {quote && quote.discountKobo > 0 && (
        <div className={row}><dt className="text-muted">Discount</dt><dd className="font-medium text-promo tabular-nums">−{formatNaira(quote.discountKobo)}</dd></div>
      )}
      <div className={row}>
        <dt className="text-muted">{isPickup ? "Pickup" : "Delivery"}{quote ? ` (${quote.totalKg}kg)` : ""}</dt>
        <dd className="font-medium tabular-nums">
          {!zoneChosen ? <span className="text-muted">Choose area</span> : quote ? (quote.deliveryFeeKobo === 0 ? "Free" : formatNaira(quote.deliveryFeeKobo)) : "…"}
        </dd>
      </div>
      <div className={`${row} border-t border-border pt-3 text-base`}>
        <dt className="font-semibold">Total</dt>
        <dd className="font-bold text-lg tabular-nums">{formatNaira(quote?.totalKobo ?? subtotalKobo)}</dd>
      </div>
    </dl>
  );
}

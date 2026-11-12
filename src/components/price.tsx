import { formatNaira, perKgKobo } from "@/lib/money";

export function Price({
  kobo,
  compareAt,
  sizeKg,
  onDark = false,
  size = "md",
}: {
  kobo: number | null;
  compareAt?: number | null;
  sizeKg?: number;
  onDark?: boolean;
  size?: "md" | "lg";
}) {
  if (kobo == null) return <span className={onDark ? "text-white/75" : "text-muted"}>Price coming soon</span>;
  const onSale = compareAt != null && compareAt > kobo;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={`font-bold ${size === "lg" ? "text-3xl" : ""} ${onSale && !onDark ? "text-promo" : ""}`}>
        {formatNaira(kobo)}
      </span>
      {onSale && (
        <s className={`text-sm ${onDark ? "text-white/70" : "text-muted"}`} aria-label={`was ${formatNaira(compareAt)}`}>
          {formatNaira(compareAt)}
        </s>
      )}
      {sizeKg != null && (
        <span className={`text-xs ${onDark ? "text-white/75" : "text-muted"}`}>{formatNaira(perKgKobo(kobo, sizeKg))}/kg</span>
      )}
    </span>
  );
}

export function SaleBadge({ kobo, compareAt }: { kobo: number | null; compareAt: number | null }) {
  if (kobo == null || compareAt == null || compareAt <= kobo) return null;
  const pct = Math.round(((compareAt - kobo) / compareAt) * 100);
  return (
    <span className="inline-block rounded-full bg-promo px-2.5 py-0.5 text-xs font-bold text-white">−{pct}%</span>
  );
}

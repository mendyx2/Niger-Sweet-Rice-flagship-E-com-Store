import { formatNaira, perKgKobo } from "@/lib/money";

export function Price({
  kobo,
  compareAt,
  sizeKg,
  onDark = false,
}: {
  kobo: number | null;
  compareAt?: number | null;
  sizeKg?: number;
  onDark?: boolean;
}) {
  if (kobo == null) return <span className={onDark ? "text-white/75" : "text-muted"}>Price coming soon</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className="font-semibold">{formatNaira(kobo)}</span>
      {compareAt != null && compareAt > kobo && (
        <s className="text-muted text-sm" aria-label={`was ${formatNaira(compareAt)}`}>{formatNaira(compareAt)}</s>
      )}
      {sizeKg != null && <span className="text-muted text-xs">{formatNaira(perKgKobo(kobo, sizeKg))}/kg</span>}
    </span>
  );
}

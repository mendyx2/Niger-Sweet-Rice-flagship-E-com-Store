/** Month helpers for statements (Africa/Lagos, UTC+1, no daylight saving). */

/** Lagos month boundaries, e.g. "2026-11" → [1 Nov 00:00, 1 Dec 00:00) Africa/Lagos (UTC+1). */
export function monthRange(month: string): { from: Date; to: Date; label: string } {
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1, -1)); // 00:00 Lagos = 23:00 UTC the previous day
  const to = new Date(Date.UTC(y, m, 1, -1));
  const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-NG", { month: "long", year: "numeric", timeZone: "UTC" });
  return { from, to, label };
}

export function currentMonth(now = new Date()): string {
  return new Date(now.getTime() + 3600_000).toISOString().slice(0, 7);
}

export function isMonth(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

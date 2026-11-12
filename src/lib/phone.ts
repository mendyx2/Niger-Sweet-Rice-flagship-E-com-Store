/**
 * Nigerian mobile numbers → E.164 (+234XXXXXXXXXX).
 * Accepts 08012345678, 8012345678, 2348012345678, +234 801 234 5678.
 * Valid mobile prefixes start with 7, 8 or 9 followed by 0 or 1 (070, 080, 081, 090, 091, ...).
 */
export function normalizeNgPhone(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (!/^\d+$/.test(d)) return null;
  if (d.startsWith("234")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  if (!/^[789][01]\d{8}$/.test(d)) return null;
  return `+234${d}`;
}

/** +2348012345678 → "0801 234 5678" */
export function formatNgPhone(e164: string): string {
  const local = "0" + e164.replace(/^\+234/, "");
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/** +2348012345678 → "0801 *** 5678" for display in messages and logs. */
export function maskPhone(e164: string): string {
  const f = formatNgPhone(e164);
  return `${f.slice(0, 4)} *** ${f.slice(-4)}`;
}

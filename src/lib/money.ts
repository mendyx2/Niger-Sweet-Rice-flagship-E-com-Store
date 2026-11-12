/** All money is integer kobo (₦1 = 100 kobo). */

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

/** 125000000 → "₦1,250,000" (whole naira; kobo are rounded for display only). */
export function formatNaira(kobo: number): string {
  return naira.format(Math.round(kobo / 100));
}

/** Parse a staff-entered naira amount ("45,000" / "45000.50") into kobo. */
export function nairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function koboToNairaInput(kobo: number | null | undefined): string {
  if (kobo == null) return "";
  return kobo % 100 === 0 ? String(kobo / 100) : (kobo / 100).toFixed(2);
}

/** Price per kg, in kobo, rounded to the nearest kobo. */
export function perKgKobo(priceKobo: number, sizeKg: number): number {
  return Math.round(priceKobo / sizeKg);
}

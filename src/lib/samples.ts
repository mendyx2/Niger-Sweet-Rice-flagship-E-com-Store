/** Normalises an address so "12, Aminu Kano Cres." and "12 aminu kano cres" count as the same place. */
export function sampleAddressKey(zoneId: string, street: string): string {
  const norm = street
    .toLowerCase()
    .replace(/\b(crescent|cres)\b/g, "cres")
    .replace(/\b(street|st)\b/g, "st")
    .replace(/\b(road|rd)\b/g, "rd")
    .replace(/\b(avenue|ave)\b/g, "ave")
    .replace(/\b(close|cl)\b/g, "cl")
    .replace(/[^a-z0-9]/g, "");
  return `${zoneId}:${norm}`;
}

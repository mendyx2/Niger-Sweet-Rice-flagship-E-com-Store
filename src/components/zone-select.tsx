"use client";

export type ZoneOption = { id: string; name: string; kind: "PICKUP" | "ABUJA" | "NEARBY_TOWN" };

export function ZoneSelect({
  zones, value, onChange, name, id = "zone", required,
}: {
  zones: ZoneOption[]; value: string; onChange?: (v: string) => void; name?: string; id?: string; required?: boolean;
}) {
  const group = (kind: ZoneOption["kind"]) => zones.filter((z) => z.kind === kind);
  return (
    <select id={id} name={name} required={required} value={value} onChange={(e) => onChange?.(e.target.value)} className="field">
      <option value="">Choose your area…</option>
      {group("PICKUP").map((z) => <option key={z.id} value={z.id}>{z.name} (free)</option>)}
      <optgroup label="Abuja">
        {group("ABUJA").map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
      </optgroup>
      <optgroup label="Nearby towns (minimum order applies)">
        {group("NEARBY_TOWN").map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
      </optgroup>
    </select>
  );
}

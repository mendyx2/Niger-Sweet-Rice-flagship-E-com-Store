import type { Metadata } from "next";
import Link from "next/link";
import { getZones } from "@/lib/catalogue";
import { formatNaira } from "@/lib/money";

export const metadata: Metadata = {
  title: "Rice Delivery in Abuja & Nearby Towns: Areas, Fees & Minimum Orders",
  description:
    "Rice delivery across Abuja (Wuse, Garki, Maitama, Gwarinpa, Kubwa, Lugbe and more) and nearby towns like Suleja, Mararaba, Nyanya and Karu. See delivery fees and minimum orders.",
  alternates: { canonical: "/delivery" },
};

export default async function DeliveryPage() {
  const zones = await getZones();
  const groups = [
    { kind: "PICKUP", title: "Pickup" },
    { kind: "ABUJA", title: "Abuja delivery" },
    { kind: "NEARBY_TOWN", title: "Nearby towns (minimum order applies)" },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Delivery areas &amp; fees</h1>
      <p className="text-muted mt-2">
        Delivery fee = a base fee for your area + a small charge per kg. Your exact fee is shown at checkout.
        Free samples are free, but the delivery fee still applies (or pick up in store for free).
      </p>
      {groups.map((g) => {
        const list = zones.filter((z) => z.kind === g.kind);
        if (!list.length) return null;
        return (
          <section key={g.kind} className="mt-10">
            <h2 className="font-display text-xl font-bold text-brand">{g.title}</h2>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="w-full text-sm">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="p-3">Area</th>
                    <th className="p-3">Delivery fee</th>
                    <th className="p-3">Minimum order</th>
                    <th className="p-3">Usually arrives</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((z) => (
                    <tr key={z.id} className="border-t border-border align-top">
                      <td className="p-3 font-medium">
                        {z.kind === "PICKUP" ? z.name : <Link href={`/delivery/${z.slug}`} className="text-brand hover:underline">{z.name}</Link>}
                        {z.terms && <p className="text-xs text-muted font-normal mt-1">{z.terms}</p>}
                      </td>
                      <td className="p-3">
                        {z.kind === "PICKUP" ? "Free" : `${formatNaira(z.baseFeeKobo)} + ${formatNaira(z.perKgFeeKobo)}/kg`}
                      </td>
                      <td className="p-3">
                        {[z.minOrderKg && `${z.minOrderKg}kg`, z.minOrderKobo && formatNaira(z.minOrderKobo)]
                          .filter(Boolean)
                          .join(" or ") || "None"}
                      </td>
                      <td className="p-3">{z.etaHours ? `Within ${z.etaHours} hours` : "Ask us"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

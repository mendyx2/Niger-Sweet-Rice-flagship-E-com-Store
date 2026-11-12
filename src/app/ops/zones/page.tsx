import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { OpsNav } from "../ops-nav";
import { ZoneForm } from "./zone-form";

export default function ZonesPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Zones />
    </Suspense>
  );
}

async function Zones() {
  await requireOps();
  const zones = await db.deliveryZone.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <>
      <OpsNav current="zones" />
      <h1 className="font-display text-2xl font-bold">Delivery zones</h1>
      <p className="text-muted text-sm mt-1">
        Fee = base fee + (per-kg fee × total kg). Nearby towns can require a minimum order in kg and/or naira.
      </p>
      <ZoneForm
        zones={zones.map((z) => ({
          id: z.id, name: z.name, kind: z.kind, baseFeeKobo: z.baseFeeKobo, perKgFeeKobo: z.perKgFeeKobo,
          minOrderKg: z.minOrderKg, minOrderKobo: z.minOrderKobo, terms: z.terms, active: z.active,
        }))}
      />
    </>
  );
}

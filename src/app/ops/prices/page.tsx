import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireOps } from "@/lib/ops-auth";
import { formatNaira } from "@/lib/money";
import { OpsNav } from "../ops-nav";
import { PriceForm } from "./price-form";

export default function PricesPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Prices />
    </Suspense>
  );
}

async function Prices() {
  await requireOps();
  const [products, history] = await Promise.all([
    db.product.findMany({ include: { variants: { orderBy: { sizeKg: "desc" } } }, orderBy: { sortOrder: "asc" } }),
    db.priceChange.findMany({ take: 15, orderBy: { createdAt: "desc" }, include: { variant: true } }),
  ]);

  return (
    <>
      <OpsNav current="prices" />
      <h1 className="font-display text-2xl font-bold">Prices &amp; stock</h1>
      <p className="text-muted text-sm mt-1">
        Enter prices in naira. Leave the retail price empty to show &ldquo;Price coming soon&rdquo;. Changes appear
        on the shop as soon as you save.
      </p>
      {products.map((p) => (
        <section key={p.id} className="mt-6">
          <h2 className="font-semibold text-lg">{p.name}</h2>
          <PriceForm
            variants={p.variants.map((v) => ({
              id: v.id, sizeKg: v.sizeKg, sku: v.sku, retailPriceKobo: v.retailPriceKobo,
              wholesalePriceKobo: v.wholesalePriceKobo, compareAtPriceKobo: v.compareAtPriceKobo,
              stockQty: v.stockQty, reservedQty: v.reservedQty, active: v.active,
            }))}
          />
        </section>
      ))}

      <section className="mt-10">
        <h2 className="font-semibold">Recent price changes</h2>
        {history.length === 0 ? (
          <p className="text-muted text-sm mt-2">No changes yet.</p>
        ) : (
          <ul className="mt-2 text-sm space-y-1">
            {history.map((h) => (
              <li key={h.id} className="text-muted">
                {h.createdAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}: {h.variant.sizeKg}kg{" "}
                {h.field.replace("PriceKobo", "")}: {h.oldValue == null ? "none" : formatNaira(h.oldValue)} →{" "}
                {h.newValue == null ? "none" : formatNaira(h.newValue)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

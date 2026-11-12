import type { Metadata } from "next";
import { getZones } from "@/lib/catalogue";
import { CartView } from "./cart-view";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default async function CartPage() {
  const zones = await getZones();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <h1 className="font-display text-4xl font-bold">Your cart</h1>
      <CartView zones={zones.map((z) => ({ id: z.id, name: z.name, kind: z.kind }))} />
    </div>
  );
}

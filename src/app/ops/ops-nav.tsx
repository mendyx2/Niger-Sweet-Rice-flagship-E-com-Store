import Link from "next/link";
import { logout } from "./actions";

export function OpsNav({ current }: { current: "orders" | "returns" | "prices" | "zones" | "partners" | "promotions" }) {
  const tab = (href: string, label: string, key: string) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className={`px-3 py-1.5 rounded-full ${current === key ? "bg-brand text-white" : "hover:bg-brand-soft"}`}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Staff">
        {tab("/ops/orders", "Orders", "orders")}
        {tab("/ops/returns", "Replacements", "returns")}
        {tab("/ops/prices", "Prices & stock", "prices")}
        {tab("/ops/zones", "Delivery zones", "zones")}
        {tab("/ops/partners", "Sellers & affiliates", "partners")}
        {tab("/ops/promotions", "Promotions", "promotions")}
      </nav>
      <form action={logout}>
        <button className="text-sm underline text-muted">Sign out</button>
      </form>
    </div>
  );
}

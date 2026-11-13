import Link from "next/link";
import { signOut } from "../login/actions";
import { getHqStaff } from "@/lib/ops-auth";

export async function OpsNav({ current }: { current: "orders" | "distributors" | "restocks" | "statements" | "returns" | "reports" | "prices" | "zones" | "partners" | "promotions" | "team" }) {
  const staff = await getHqStaff();
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
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted">HQ · <strong className="text-foreground">{staff?.user.name ?? "Staff"}</strong> <span className="text-xs">({staff?.role === "OWNER" ? "owner" : "staff"})</span></p>
        <form action={signOut}><button className="underline text-muted">Sign out</button></form>
      </div>
      <nav className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Staff">
        {tab("/ops/orders", "Orders", "orders")}
        {tab("/ops/distributors", "Distributors", "distributors")}
        {tab("/ops/restocks", "Restocks", "restocks")}
        {tab("/ops/statements", "Statements", "statements")}
        {tab("/ops/returns", "Replacements", "returns")}
        {tab("/ops/reports", "Reports", "reports")}
        {tab("/ops/prices", "Prices & stock", "prices")}
        {tab("/ops/zones", "HQ delivery fees", "zones")}
        {tab("/ops/partners", "Sellers & affiliates", "partners")}
        {tab("/ops/promotions", "Promotions", "promotions")}
        {staff?.role === "OWNER" && tab("/ops/team", "HQ team", "team")}
      </nav>
    </div>
  );
}

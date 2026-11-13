import Link from "next/link";
import { signOut } from "../login/actions";

const TABS = [
  { href: "/partner", label: "Orders", key: "orders" },
  { href: "/partner/stock", label: "Stock", key: "stock" },
  { href: "/partner/sales", label: "Shop sales", key: "sales" },
  { href: "/partner/reports", label: "My numbers", key: "reports" },
  { href: "/partner/settings", label: "Prices & delivery", key: "settings", owner: true },
  { href: "/partner/staff", label: "Staff", key: "staff", owner: true },
] as const;

export function PartnerNav({ current, name, isOwner }: { current: (typeof TABS)[number]["key"]; name: string; isOwner: boolean }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Partner portal · <strong className="text-foreground">{name}</strong></p>
        <form action={signOut}><button className="text-sm text-muted underline">Sign out</button></form>
      </div>
      <nav className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Partner">
        {TABS.filter((t) => !("owner" in t) || isOwner).map((t) => (
          <Link key={t.key} href={t.href} aria-current={current === t.key ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 ${current === t.key ? "bg-brand text-white" : "hover:bg-brand-soft"}`}>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

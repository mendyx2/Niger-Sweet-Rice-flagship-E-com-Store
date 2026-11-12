import Link from "next/link";

const nav = [
  { href: "/shop", label: "Shop" },
  { href: "/promotions", label: "Promotions" },
  { href: "/delivery", label: "Delivery" },
  { href: "/returns-policy", label: "Returns" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-surface/90 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:h-16 sm:py-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Link href="/" className="font-display text-xl font-bold text-brand whitespace-nowrap">
          Niger Sweet Rice
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-1 sm:gap-x-4 text-sm -mx-2 sm:mx-0">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="px-2 py-1 rounded hover:bg-brand-soft whitespace-nowrap">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

import Link from "next/link";
import { CartButton } from "./cart-button";
import { Logo } from "./logo";
import { UserIcon } from "./icons";

const nav = [
  { href: "/shop", label: "Shop" },
  { href: "/promotions", label: "Promotions" },
  { href: "/delivery", label: "Delivery" },
  { href: "/track", label: "Track order" },
];

export function SiteHeader() {
  return (
    <>
      <p className="bg-brand-strong text-white/90 text-xs sm:text-sm text-center px-4 py-2">
        Delivery across Abuja &amp; nearby towns · <span className="text-cta font-semibold">Free pickup</span> at our flagship store
      </p>
      {/* Only the logo / account / cart row stays pinned, to leave room for content on phones. */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden md:flex items-center gap-1 text-sm font-medium">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="px-3 py-2 rounded-full hover:bg-brand-soft">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <Link href="/account" aria-label="My account" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-brand-soft">
              <UserIcon className="h-6 w-6" />
            </Link>
            <CartButton />
          </div>
        </div>
      </header>
      {/* Mobile: nav row under the logo (scrolls away) */}
      <nav aria-label="Main mobile" className="md:hidden flex justify-between gap-1 border-b border-border bg-surface px-3 py-1.5 text-sm font-medium">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="px-2.5 py-1.5 rounded-full hover:bg-brand-soft whitespace-nowrap">
              {n.label}
            </Link>
          ))}
      </nav>
    </>
  );
}

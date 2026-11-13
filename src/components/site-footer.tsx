import Link from "next/link";
import { site } from "@/lib/site";
import { Logo } from "./logo";
import { CookieSettingsLink } from "./consent";

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-brand text-white/85">
      <div className="h-1.5 bg-[linear-gradient(90deg,var(--brand-strong)_0_33%,var(--promo)_33%_66%,var(--cta)_66%)]" aria-hidden="true" />
      <div className="mx-auto max-w-6xl px-4 py-12 grid gap-10 sm:grid-cols-3 text-sm">
        <div>
          <Logo onDark />
          <p className="mt-3 max-w-xs">Quality parboiled rice from our flagship store in Abuja.</p>
        </div>
        <address className="not-italic space-y-1">
          <p className="font-semibold text-white">Visit or call us</p>
          {site.street && <p>{site.street}</p>}
          <p>{[site.area, site.city, site.region].filter(Boolean).join(", ")}</p>
          {site.phone && (
            <p><a className="underline underline-offset-2 hover:text-white" href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a></p>
          )}
          <p>{site.hoursLabel}</p>
        </address>
        <ul className="space-y-2">
          <li><Link className="hover:text-white hover:underline" href="/shop">Shop all bag sizes</Link></li>
          <li><Link className="hover:text-white hover:underline" href="/delivery">Delivery areas &amp; fees</Link></li>
          <li><Link className="hover:text-white hover:underline" href="/track">Track your order</Link></li>
          <li><Link className="hover:text-white hover:underline" href="/returns-policy">Bag replacement policy</Link></li>
          <li><Link className="hover:text-white hover:underline" href="/register?as=seller">Sell / resell our rice</Link></li>
          <li><Link className="hover:text-white hover:underline" href="/faq">FAQ</Link></li>
          <li><Link className="hover:text-white hover:underline" href="/partner">Distributor login</Link></li>
        </ul>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pb-8 text-xs text-white/70">
        <span>© {site.name}. All rights reserved.</span>
        <Link href="/privacy" className="hover:text-white hover:underline">Privacy</Link>
        <Link href="/terms" className="hover:text-white hover:underline">Terms</Link>
        <CookieSettingsLink />
      </div>
    </footer>
  );
}

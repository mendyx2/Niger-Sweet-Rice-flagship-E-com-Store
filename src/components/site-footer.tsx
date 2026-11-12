import Link from "next/link";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface mt-16">
      <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 sm:grid-cols-3 text-sm">
        <div>
          <p className="font-display text-lg font-bold text-brand">Niger Sweet Rice</p>
          <p className="text-muted mt-2">Flagship store, Abuja</p>
        </div>
        <address className="not-italic text-muted space-y-1">
          <p className="font-semibold text-foreground">Visit or call us</p>
          {site.street && <p>{site.street}</p>}
          <p>{[site.area, site.city, site.region].filter(Boolean).join(", ")}</p>
          {site.phone && <p><a className="underline" href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a></p>}
          <p>{site.hoursLabel}</p>
        </address>
        <ul className="space-y-1">
          <li><Link className="hover:underline" href="/shop">Shop all bag sizes</Link></li>
          <li><Link className="hover:underline" href="/delivery">Delivery areas &amp; fees</Link></li>
          <li><Link className="hover:underline" href="/returns-policy">Bag replacement policy</Link></li>
          <li><Link className="hover:underline" href="/promotions">Promotions</Link></li>
        </ul>
      </div>
      <p className="text-center text-xs text-muted pb-6">© Niger Sweet Rice. All rights reserved.</p>
    </footer>
  );
}

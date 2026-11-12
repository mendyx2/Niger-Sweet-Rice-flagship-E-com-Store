"use client";

import Link from "next/link";
import Script from "next/script";
import { useSyncExternalStore } from "react";

/**
 * Cookie consent (NDPA 2023). Essential cookies (login, cart) always work;
 * analytics/marketing scripts load only after "Accept". The choice is kept in
 * this browser and can be changed from "Cookie settings" in the footer.
 */
const KEY = "nsr_consent";
/** "pending" = not known yet (server render / before hydration). */
type Choice = "granted" | "denied" | null | "pending";
const listeners = new Set<() => void>();

function read(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}
function write(v: Choice) {
  try {
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const useChoice = () => useSyncExternalStore<Choice>(subscribe, read, () => "pending");

export function ConsentBanner() {
  const choice = useChoice();
  if (choice !== null) return null; // already chosen, or not known yet
  return (
    <div role="dialog" aria-live="polite" aria-label="Cookie choices"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-border bg-surface p-4 shadow-2xl sm:p-5">
      <p className="text-sm">
        We use essential cookies to keep you signed in and remember your cart. With your permission we&apos;d also like to use
        analytics cookies to understand how people use the site and improve our offers. <Link href="/privacy" className="underline">Privacy policy</Link>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => write("granted")} className="btn-cta py-2">Accept</button>
        <button type="button" onClick={() => write("denied")} className="rounded-full border border-border px-5 py-2 font-semibold hover:bg-background">
          Only essential
        </button>
      </div>
    </div>
  );
}

export function CookieSettingsLink() {
  return (
    <button type="button" onClick={() => write(null)} className="hover:text-white hover:underline">
      Cookie settings
    </button>
  );
}

const GA = process.env.NEXT_PUBLIC_GA_ID;
const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function Analytics() {
  const choice = useChoice();
  if (choice !== "granted") return null;
  return (
    <>
      {GA && /^G-[A-Z0-9]+$/.test(GA) && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${GA}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {PIXEL && /^\d+$/.test(PIXEL) && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}

"use client";

import { useState } from "react";

export function PromoCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }}
      className="mt-4 inline-flex items-center gap-3 rounded-xl border-2 border-dashed border-cta px-4 py-2 font-mono text-lg font-bold tracking-wider text-cta hover:bg-white/10"
      aria-label={`Copy coupon code ${code}`}
    >
      {code}
      <span className="font-sans text-xs font-semibold text-white/80">{copied ? "Copied!" : "Tap to copy"}</span>
    </button>
  );
}

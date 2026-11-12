"use client";

import { useState } from "react";

export function CopyButton({ text, label, share = false }: { text: string; label: string; share?: boolean }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    if (share && navigator.share) {
      try { await navigator.share({ text: "Get quality rice delivered in Abuja:", url: text }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  return (
    <button type="button" onClick={onClick} className={share ? "btn-primary mt-3 w-full py-2.5" : "shrink-0 rounded-full border border-brand px-4 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft"}>
      {copied ? "Copied!" : label}
    </button>
  );
}

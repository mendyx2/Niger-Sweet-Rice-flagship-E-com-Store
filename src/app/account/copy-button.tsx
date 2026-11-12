"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ text: "Get quality rice delivered in Abuja:", url: text }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  return (
    <button type="button" onClick={share} className="btn-primary mt-3 w-full py-2.5">
      {copied ? "Copied!" : "Share link"}
    </button>
  );
}

"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted">Sorry about that. Please try again. If you were paying, your payment is safe; check your order in My account.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="btn-cta">Try again</button>
        <Link href="/account" className="btn-outline">My account</Link>
      </div>
    </div>
  );
}

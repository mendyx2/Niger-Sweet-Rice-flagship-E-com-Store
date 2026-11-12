import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="font-display text-7xl font-bold text-brand">404</p>
      <h1 className="font-display text-3xl font-bold mt-4">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted">It may have moved. Here are some places to start:</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/shop" className="btn-cta">Shop rice</Link>
        <Link href="/track" className="btn-outline">Track an order</Link>
      </div>
    </div>
  );
}

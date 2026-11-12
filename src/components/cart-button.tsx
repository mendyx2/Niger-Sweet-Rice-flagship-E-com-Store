"use client";

import Link from "next/link";
import { useCartCount } from "@/lib/cart-store";
import { CartIcon } from "./icons";

export function CartButton() {
  const count = useCartCount();
  return (
    <Link
      href="/cart"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-brand-soft"
      aria-label={count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart, empty"}
    >
      <CartIcon className="h-6 w-6" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-5 h-5 rounded-full bg-cta px-1 text-xs font-bold leading-5 text-brand-strong text-center ring-2 ring-surface">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

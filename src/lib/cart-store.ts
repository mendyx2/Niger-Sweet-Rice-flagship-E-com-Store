"use client";

/**
 * Guest-friendly cart kept in localStorage (works for logged-out shoppers and
 * survives refreshes). It stores only variant IDs and quantities: every price,
 * fee and total is recalculated on the server from the database.
 */
import { useSyncExternalStore } from "react";

export type CartLine = { variantId: string; qty: number };

const KEY = "nsr_cart_v1";
const MAX_QTY = 100;
const listeners = new Set<() => void>();
let cache: CartLine[] | null = null;
const EMPTY: CartLine[] = [];

function read(): CartLine[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(raw)
      ? raw.filter((l) => typeof l?.variantId === "string" && Number.isInteger(l?.qty) && l.qty > 0)
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(lines: CartLine[]) {
  cache = lines;
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* private mode / storage full: cart still works for this page view */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage); // sync across tabs
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export const cart = {
  add(variantId: string, qty = 1) {
    const lines = [...read()];
    const i = lines.findIndex((l) => l.variantId === variantId);
    if (i >= 0) lines[i] = { variantId, qty: Math.min(lines[i].qty + qty, MAX_QTY) };
    else lines.push({ variantId, qty: Math.min(qty, MAX_QTY) });
    write(lines);
  },
  setQty(variantId: string, qty: number) {
    const q = Math.max(0, Math.min(Math.floor(qty), MAX_QTY));
    write(q === 0 ? read().filter((l) => l.variantId !== variantId) : read().map((l) => (l.variantId === variantId ? { ...l, qty: q } : l)));
  },
  remove(variantId: string) {
    write(read().filter((l) => l.variantId !== variantId));
  },
  clear() {
    write([]);
  },
};

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function useCartCount(): number {
  return useCart().reduce((s, l) => s + l.qty, 0);
}

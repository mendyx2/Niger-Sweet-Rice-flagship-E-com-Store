"use client";

/** The customer's delivery area, remembered in this browser and shared by the header, product pages and cart. */
import { useSyncExternalStore } from "react";

const KEY = "nsr_zone";
const EVENT = "nsr-zone-change";

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function setZone(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/** "" until the browser has loaded (and when no area has been chosen). */
export function useZone(): string {
  return useSyncExternalStore(subscribe, read, () => "");
}

export function openAreaPicker() {
  window.dispatchEvent(new Event("nsr-open-area-picker"));
}

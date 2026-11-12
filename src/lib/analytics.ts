"use client";

/**
 * Marketing analytics, only after the visitor accepts cookies.
 * GA4 (NEXT_PUBLIC_GA_ID) and Meta Pixel (NEXT_PUBLIC_META_PIXEL_ID) are
 * loaded by <Analytics/>; until then these calls do nothing.
 */
type Item = { item_id: string; item_name: string; item_variant?: string; price: number; quantity: number };

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

const naira = (kobo: number) => Math.round(kobo) / 100;

export function track(event: "view_item" | "add_to_cart" | "begin_checkout" | "purchase" | "sign_up" | "generate_lead",
  data: { valueKobo?: number; items?: Item[]; transactionId?: string } = {}) {
  if (typeof window === "undefined") return;
  const value = data.valueKobo != null ? naira(data.valueKobo) : undefined;
  window.gtag?.("event", event, {
    currency: "NGN",
    value,
    transaction_id: data.transactionId,
    items: data.items,
  });
  const meta: Record<string, string> = {
    view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout",
    purchase: "Purchase", sign_up: "CompleteRegistration", generate_lead: "Lead",
  };
  window.fbq?.("track", meta[event], { currency: "NGN", value, content_ids: data.items?.map((i) => i.item_id), content_type: "product" },
    data.transactionId ? { eventID: data.transactionId } : undefined);
}

export const toItem = (v: { sku: string; sizeKg: number; priceKobo: number; qty?: number }, name: string): Item => ({
  item_id: v.sku, item_name: name, item_variant: `${v.sizeKg}kg`, price: naira(v.priceKobo), quantity: v.qty ?? 1,
});

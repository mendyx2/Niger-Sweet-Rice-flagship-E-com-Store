"use server";

import { z } from "zod";
import { priceCart, couponMessage } from "@/lib/checkout-data";
import { describeIssue } from "@/lib/pricing";
import { formatNaira } from "@/lib/money";
import { getCurrentUser, isApprovedSeller } from "@/lib/auth";

const input = z.object({
  lines: z.array(z.object({ variantId: z.string().max(40), qty: z.number().int().min(1).max(100) })).max(20),
  zoneId: z.string().max(40).nullable().optional(),
  couponCode: z.string().max(40).nullable().optional(),
});

/** Prices the cart on the server. The browser never decides amounts. */
export async function getCartQuote(raw: unknown) {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return null;
  const user = await getCurrentUser();
  const r = await priceCart({
    ...parsed.data,
    userId: user?.id,
    wholesale: user ? isApprovedSeller(user) : false,
  });
  return {
    ...r,
    issues: r.quote?.issues.map((i) => describeIssue(i, formatNaira)) ?? [],
    couponMessage: couponMessage(r.couponIssue),
  };
}

export type CartQuoteResult = NonNullable<Awaited<ReturnType<typeof getCartQuote>>>;

import { NextResponse, type NextRequest } from "next/server";
import { verifyTransaction, isPaystackConfigured } from "@/lib/paystack";
import { orderNumberFromReference } from "@/lib/paystack-signature";
import { markOrderPaid } from "@/lib/orders";

/**
 * Paystack sends the shopper back here after payment. We never trust the
 * redirect itself: the transaction is verified server-to-server first.
 * (The webhook does the same independently, in case the shopper closes the tab.)
 */
export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("reference") ?? req.nextUrl.searchParams.get("trxref") ?? "";
  const number = orderNumberFromReference(reference);
  if (!number || !isPaystackConfigured()) return NextResponse.redirect(new URL("/account", req.url));

  try {
    const tx = await verifyTransaction(reference);
    if (tx.status === "success" && tx.reference === reference) {
      await markOrderPaid(number, { reference, amountKobo: tx.amount, currency: tx.currency, source: "paystack-callback" });
    }
  } catch (e) {
    console.error("[paystack-callback] verify failed", e);
  }
  return NextResponse.redirect(new URL(`/orders/${number}`, req.url));
}

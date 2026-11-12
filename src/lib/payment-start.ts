import "server-only";
import { db } from "./db";
import { site } from "./site";
import { initializeTransaction, isDevPaymentMode, isPaystackConfigured } from "./paystack";
import { newPaymentReference } from "./orders";

/** Starts (or restarts) payment for a pending order and returns where to send the shopper. */
export async function startPayment(order: { id: string; number: string; totalKobo: number; contactEmail: string | null; contactPhone: string }) {
  const reference = newPaymentReference(order.number);
  await db.order.update({ where: { id: order.id }, data: { paymentRef: reference } });

  if (isDevPaymentMode()) return { ok: true as const, url: `/checkout/dev-pay?reference=${encodeURIComponent(reference)}` };
  if (!isPaystackConfigured()) return { ok: false as const, error: "Online payment is not available right now. Please order on WhatsApp or call us." };

  // Paystack needs an email; shoppers without one get a non-deliverable placeholder.
  const email = order.contactEmail ?? `${order.contactPhone.replace(/\D/g, "")}@customers.${new URL(site.url).hostname}`;
  try {
    const { authorizationUrl } = await initializeTransaction({
      email,
      amountKobo: order.totalKobo,
      reference,
      callbackUrl: `${site.url}/checkout/callback`,
      metadata: { order_number: order.number, custom_fields: [{ display_name: "Order", variable_name: "order_number", value: order.number }] },
    });
    return { ok: true as const, url: authorizationUrl };
  } catch (e) {
    console.error("[checkout] paystack init failed", e);
    return { ok: false as const, error: "We couldn't connect to the payment provider. Please try again in a moment." };
  }
}

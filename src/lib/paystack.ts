import "server-only";

/**
 * Paystack (https://paystack.com/docs/api/transaction). Amounts are in kobo.
 * Without PAYSTACK_SECRET_KEY in development, checkout uses a local
 * "simulate payment" page instead (never available in production).
 */
const API = "https://api.paystack.co";

export const paystackKey = () => process.env.PAYSTACK_SECRET_KEY ?? "";
export const isPaystackConfigured = () => paystackKey().length > 0;
export const isDevPaymentMode = () => !isPaystackConfigured() && process.env.NODE_ENV !== "production";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${paystackKey()}`, "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !body?.status || !body.data) {
    throw new Error(`Paystack ${path.split("/")[2] ?? path} failed: ${res.status} ${body?.message ?? ""}`.trim());
  }
  return body.data;
}

export async function initializeTransaction(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<{ authorizationUrl: string }> {
  const data = await call<{ authorization_url: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      channels: ["card", "bank", "ussd", "bank_transfer"],
    }),
  });
  return { authorizationUrl: data.authorization_url };
}

export type VerifiedTransaction = { status: string; reference: string; amount: number; currency: string };

export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  return call<VerifiedTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

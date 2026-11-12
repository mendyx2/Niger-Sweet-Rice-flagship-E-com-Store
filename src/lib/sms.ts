import "server-only";
import { maskPhone } from "./phone";

/**
 * SMS sending. Uses Termii (Nigerian SMS provider, DND-safe route) when
 * TERMII_API_KEY is set. Without a key, in development, messages are printed
 * to the server console instead. In production a missing key is an error.
 *
 * Termii request format: confirm against the current Termii docs when the
 * account is set up (https://developers.termii.com).
 */
export async function sendSms(to: string, message: string): Promise<{ ok: boolean }> {
  const key = process.env.TERMII_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      console.error("[sms] TERMII_API_KEY is not set; SMS not sent");
      return { ok: false };
    }
    console.info(`[sms:dev] to ${maskPhone(to)}: ${message}`);
    return { ok: true };
  }
  try {
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        to: to.replace(/^\+/, ""),
        from: process.env.TERMII_SENDER_ID ?? "N-Alert",
        sms: message,
        type: "plain",
        channel: process.env.TERMII_CHANNEL ?? "dnd",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[sms] Termii responded ${res.status} for ${maskPhone(to)}`);
    return { ok: res.ok };
  } catch (e) {
    console.error(`[sms] failed for ${maskPhone(to)}`, e);
    return { ok: false };
  }
}

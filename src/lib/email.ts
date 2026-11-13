import "server-only";

/**
 * Email for staff alerts via Resend (free tier covers small volumes).
 * Set RESEND_API_KEY and EMAIL_FROM (an address on a domain verified in Resend).
 * Without a key, in development, emails are printed to the server console.
 */
export const isEmailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV !== "production") console.info(`[email:dev] to ${to}: ${subject}: ${text}`);
    return process.env.NODE_ENV !== "production";
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[email] Resend responded ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error("[email]", e);
    return false;
  }
}

/** Only same-site paths. Browsers drop tabs/newlines and treat "\\" as "/", so "/\t/evil.com" would leave the site. */
export function safeNext(next: string | null | undefined, fallback = "/account"): string {
  if (!next || next.length > 500 || !next.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const u = new URL(next, "https://nsr.invalid");
    if (u.origin !== "https://nsr.invalid") return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

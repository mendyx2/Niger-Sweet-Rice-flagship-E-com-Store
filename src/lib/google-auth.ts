import { createSign } from "node:crypto";

/** Signs a Google service-account JWT (RS256) for the OAuth "jwt-bearer" grant. */
export function serviceAccountJwt(email: string, privateKeyPem: string, scope: string, now = Math.floor(Date.now() / 1000)): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKeyPem).toString("base64url");
  return `${unsigned}.${signature}`;
}

/** Keys pasted into env vars often have literal "\n" instead of newlines. */
export const normalizePem = (key: string) => key.replace(/\\n/g, "\n").trim();

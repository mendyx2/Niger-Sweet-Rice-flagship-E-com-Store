import { createHash, randomBytes } from "node:crypto";
import type { BrowserContext, Page } from "@playwright/test";
import { db } from "./db";

let counter = 0;
/** A fresh Nigerian mobile number per call, so tests never collide. */
export const newPhone = () => `0809${String(Date.now() % 10_000_000).padStart(7, "0").slice(-5)}${String(++counter).padStart(2, "0")}`;
const e164 = (local: string) => `+234${local.replace(/\D/g, "").replace(/^0/, "")}`;

/** Signs a browser in as this phone number without SMS (creates the user if needed). */
export async function signInAs(context: BrowserContext, phone: string, opts: { name?: string; roles?: ("OWNER" | "STAFF")[] } = {}) {
  const p = e164(phone);
  const user = await db.user.upsert({
    where: { phone: p },
    create: { phone: p, name: opts.name ?? null, referralCode: `T${randomBytes(4).toString("hex").toUpperCase()}`, roles: ["BUYER", ...(opts.roles ?? [])] },
    update: opts.roles ? { roles: ["BUYER", ...opts.roles] } : {},
  });
  const token = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: createHash("sha256").update(token).digest("hex"), userId: user.id, expiresAt: new Date(Date.now() + 86400_000) } });
  await context.addCookies([{ name: "nsr_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await context.addInitScript(() => { try { localStorage.setItem("nsr_consent", "denied"); } catch {} });
  return user;
}

/** Real login through the phone + code screen (development mode shows the code on screen). */
export async function loginWithCode(page: Page, phone: string) {
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  const code = (await page.getByText("your code is").locator("strong").textContent())!.trim();
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Verify & continue" }).click();
}

export async function chooseArea(page: Page, zoneId: string) {
  await page.evaluate((z) => localStorage.setItem("nsr_zone", z), zoneId);
}

/** Accepts the browser confirm() prompts used before important actions. */
export const acceptDialogs = (page: Page) => page.on("dialog", (d) => d.accept());

export const statusText = (page: Page, re: RegExp) => page.locator("main [role=status]").filter({ hasText: re }).first();

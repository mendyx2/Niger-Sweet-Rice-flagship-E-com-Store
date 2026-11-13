import { describe, expect, it } from "vitest";
import { checkEnv } from "@/lib/env-check";

const full = {
  DATABASE_URL: "postgres://x", NEXT_PUBLIC_SITE_URL: "https://naijasweetrice.ng", SESSION_SECRET: "x".repeat(40),
  HQ_OWNER_PHONES: "08031234567", TERMII_API_KEY: "k", CRON_SECRET: "c",
  TELEGRAM_BOT_TOKEN: "t", TELEGRAM_WEBHOOK_SECRET: "s", RESEND_API_KEY: "r", EMAIL_FROM: "a@b.ng",
  GOOGLE_SHEETS_ID: "g", GOOGLE_SERVICE_ACCOUNT_EMAIL: "e", GOOGLE_SERVICE_ACCOUNT_KEY: "k",
  NEXT_PUBLIC_STORE_PHONE: "1", NEXT_PUBLIC_STORE_STREET: "2",
};
describe("startup settings check", () => {
  it("passes with everything set", () => expect(checkEnv(full)).toEqual({ missing: [], warnings: [] }));
  it("lists missing essentials and a non-https address", () => {
    const r = checkEnv({ ...full, SESSION_SECRET: "short", TERMII_API_KEY: undefined, NEXT_PUBLIC_SITE_URL: "http://x.ng" });
    expect(r.missing.map((m) => m.split(":")[0])).toEqual(["SESSION_SECRET", "TERMII_API_KEY", "NEXT_PUBLIC_SITE_URL"]);
  });
  it("only warns about optional features", () => {
    const r = checkEnv({ ...full, TELEGRAM_BOT_TOKEN: undefined, GOOGLE_SHEETS_ID: undefined });
    expect(r.missing).toEqual([]);
    expect(r.warnings).toHaveLength(2);
  });
});

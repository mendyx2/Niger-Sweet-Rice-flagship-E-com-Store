import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: the real site in a real browser, against its own database
 * (E2E_DATABASE_URL; migrations applied and fixtures reset on every run, nothing is wiped).
 * Run with `npm run e2e`. Never point E2E_DATABASE_URL at a live database.
 */
export const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgresql://nsr:nsr@localhost:5432/nsr_e2e?schema=public";
const PORT = 3200;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1, // tests share one database
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: E2E_DB,
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-secret",
      HQ_OWNER_PHONES: "08011112222",
      CRON_SECRET: "e2e-cron-secret",
      TELEGRAM_WEBHOOK_SECRET: "e2e-telegram-secret",
      E2E_NO_RATE_LIMIT: "1",
      // No SMS/Telegram/email keys: development mode shows login codes on screen and logs messages.
      TERMII_API_KEY: "",
      TELEGRAM_BOT_TOKEN: "",
      RESEND_API_KEY: "",
      NEXT_PUBLIC_GA_ID: "",
      NEXT_PUBLIC_META_PIXEL_ID: "",
    },
  },
});

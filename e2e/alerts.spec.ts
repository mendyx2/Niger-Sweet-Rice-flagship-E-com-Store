import { expect, test } from "@playwright/test";
import { db } from "./db";
import { signInAs } from "./helpers";

const SECRET = "e2e-telegram-secret";
const start = (code: string, chatId: number) => ({ message: { text: `/start ${code}`, chat: { id: chatId, type: "private", first_name: "Musa" } } });

test("a distributor connects Telegram for staff alerts, and the webhook rejects forgeries", async ({ page, request }) => {
  const owner = await signInAs(page.context(), "08120003333");
  await page.goto("/partner/alerts");
  const href = await page.getByRole("link", { name: "Connect Telegram" }).getAttribute("href");
  const code = new URL(href!).searchParams.get("start")!;

  const forged = await request.post("/api/telegram/webhook", { data: start(code, 5551), headers: { "X-Telegram-Bot-Api-Secret-Token": "wrong" } });
  expect(forged.status()).toBe(401);
  await request.post("/api/telegram/webhook", { data: start(`${code.slice(0, -1)}0`, 5551), headers: { "X-Telegram-Bot-Api-Secret-Token": SECRET } });
  expect(await db.telegramChat.count({ where: { chatId: "5551" } })).toBe(0);

  const ok = await request.post("/api/telegram/webhook", { data: start(code, 5551), headers: { "X-Telegram-Bot-Api-Secret-Token": SECRET } });
  expect(ok.status()).toBe(200);
  expect(await db.telegramChat.findUnique({ where: { chatId: "5551" } })).toMatchObject({ userId: owner.id, isHq: false });
  await page.reload();
  await expect(page.getByText("✓ Connected")).toBeVisible();

  await request.post("/api/telegram/webhook", { data: { message: { text: "/stop", chat: { id: 5551, type: "private" } } }, headers: { "X-Telegram-Bot-Api-Secret-Token": SECRET } });
  expect(await db.telegramChat.count({ where: { chatId: "5551" } })).toBe(0);
});

test("the health check and the protected housekeeping job", async ({ request }) => {
  expect((await (await request.get("/api/health")).json()).ok).toBe(true);
  expect((await request.get("/api/cron/release-reservations")).status()).toBe(401);
  const run = await request.get("/api/cron/release-reservations", { headers: { Authorization: "Bearer e2e-cron-secret" } });
  expect(run.status()).toBe(200);
  expect(await run.json()).toMatchObject({ ok: true });
});

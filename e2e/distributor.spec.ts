import { expect, test } from "@playwright/test";
import { db, stockOf, zoneId } from "./db";
import { acceptDialogs, chooseArea, newPhone, signInAs, statusText } from "./helpers";

test.describe.configure({ mode: "serial" });

const GOVA_OWNER = "08120003333";

test("a Gwarinpa order goes to Gova Max, is paid into Gova's account and delivered", async ({ page, browser }) => {
  await signInAs(page.context(), newPhone(), { name: "Tunde Bakare" });
  await page.goto("/");
  await chooseArea(page, await zoneId("Gwarinpa"));
  await page.goto("/p/naija-sweet-rice?size=50");
  await expect(page.getByText("Sold by")).toContainText("Gova Max Ltd");
  await expect(page.getByText("₦84,000").first()).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/cart");
  await expect(page.locator("aside")).toContainText("Delivered by Gova Max Ltd");
  await expect(page.locator("aside dl")).toContainText("₦2,500"); // Gova's fee: ₦1,500 + ₦20 × 50kg
  await page.getByRole("link", { name: "Checkout" }).click();
  await page.getByLabel("Full name").fill("Tunde Bakare");
  await page.getByLabel("Street address").fill("12 Road 3, Gwarinpa Estate");
  const before = (await stockOf("gova-max-ltd", 50)).onHand;
  await page.getByRole("button", { name: /^Pay ₦/ }).click();
  await page.waitForURL(/\/orders\/NSR-/);
  const number = page.url().split("/").pop()!;
  await expect(page.locator("section", { hasText: "Pay by bank transfer" })).toContainText("0234567891");
  await page.getByRole("button", { name: "I've made the transfer" }).click();
  await expect(page.getByText("Waiting for the seller to confirm")).toBeVisible();

  const gctx = await browser.newContext();
  await signInAs(gctx, GOVA_OWNER);
  const gp = await gctx.newPage();
  acceptDialogs(gp);
  await gp.goto("/partner?f=pay");
  await gp.locator("li", { hasText: number }).getByRole("button", { name: "Payment received" }).click();
  await expect(gp.locator("li", { hasText: number }).getByText("Transfer confirmed")).toBeVisible();

  const order = await db.order.findUniqueOrThrow({ where: { number } });
  expect(order).toMatchObject({ status: "PAID", hqFeeKobo: 50_000, routedToHq: false });
  expect((await stockOf("gova-max-ltd", 50)).onHand).toBe(before - 1);

  await gp.goto("/partner?f=todo");
  for (const status of ["OUT_FOR_DELIVERY", "DELIVERED"]) {
    const card = gp.locator("li", { hasText: number });
    await card.locator("select[name=status]").selectOption(status);
    if (status === "OUT_FOR_DELIVERY") await card.locator("input[name=riderName]").fill("Sani");
    await card.getByRole("button", { name: "Update & notify" }).click();
    await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { number } })).status).toBe(status);
  }
});

test("ordering more than Gova holds sends the order to HQ", async ({ page }) => {
  await signInAs(page.context(), newPhone());
  await page.goto("/");
  await chooseArea(page, await zoneId("Gwarinpa"));
  await page.goto("/p/naija-sweet-rice?size=25");
  await expect(page.getByText("Sold by")).toBeVisible();
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Increase quantity" }).click(); // 6 bags; Gova has 4
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/cart");
  await expect(page.locator("aside")).toContainText("Delivered by Naija Sweet Rice HQ");
  await expect(page.locator("aside")).toContainText("HQ will deliver");
});

test("a distributor's own promo code only works on its orders, with no HQ credit", async ({ page, browser }) => {
  const gctx = await browser.newContext();
  await signInAs(gctx, GOVA_OWNER);
  const gp = await gctx.newPage();
  await gp.goto("/partner/settings");
  const code = `GT${Date.now().toString(36).toUpperCase().slice(-6)}`;
  await gp.getByLabel("Code", { exact: true }).fill(code);
  await gp.getByLabel("Amount", { exact: true }).fill("10");
  await gp.getByRole("button", { name: "Create code" }).click();
  await expect(statusText(gp, /is live/)).toBeVisible();

  await signInAs(page.context(), newPhone(), { name: "Ada Customer" });
  await page.goto("/");
  await chooseArea(page, await zoneId("Gwarinpa"));
  await page.goto("/p/naija-sweet-rice?size=50");
  await expect(page.getByText("Sold by")).toContainText("Gova Max Ltd");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/cart");
  await page.getByPlaceholder("Coupon code").fill(code.toLowerCase());
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(`Coupon ${code} applied`)).toBeVisible();
  await expect(page.locator("aside dl")).toContainText("−₦8,400");
  await page.locator("#zone").selectOption({ label: "Garki" });
  await expect(page.getByText("different seller")).toBeVisible();
  await page.locator("#zone").selectOption({ label: "Gwarinpa" });
  await page.getByRole("link", { name: "Checkout" }).click();
  await page.getByLabel("Full name").fill("Ada Customer");
  await page.getByLabel("Street address").fill("3 Kubwa Road");
  await page.getByRole("button", { name: /^Pay ₦/ }).click();
  await page.waitForURL(/\/orders\/NSR-/);
  const order = await db.order.findUniqueOrThrow({ where: { number: page.url().split("/").pop()! } });
  expect(order).toMatchObject({ discountKobo: 840_000, hqFundedDiscountKobo: 0 });
});

test("restock: request → invoice → distributor pays HQ → dispatch → receive", async ({ browser }) => {
  const gctx = await browser.newContext();
  await signInAs(gctx, GOVA_OWNER);
  const gp = await gctx.newPage();
  await gp.goto("/partner/stock");
  await gp.getByLabel("Request 50kg bags").fill("5");
  await gp.getByRole("button", { name: "Request stock" }).click();
  await expect(statusText(gp, /Request RS-/)).toBeVisible();
  const rs = (await db.restockOrder.findFirstOrThrow({ orderBy: { createdAt: "desc" } })).number;

  const hctx = await browser.newContext();
  await signInAs(hctx, "08011112222");
  const ops = await hctx.newPage();
  acceptDialogs(ops);
  await ops.goto("/ops/restocks?f=new");
  await ops.locator("li", { hasText: rs }).getByRole("button", { name: "Send invoice" }).click();
  await expect(ops.locator("li", { hasText: rs }).getByText(/Invoiced \d/)).toBeVisible();
  expect((await db.restockOrder.findUniqueOrThrow({ where: { number: rs } })).totalKobo).toBe(5 * 7_800_000);

  await gp.goto("/partner/stock");
  await expect(gp.getByText(/Pay ₦390,000 to Zenith Bank 1012345678/)).toBeVisible();
  await gp.getByRole("button", { name: "I've paid HQ" }).click();
  await expect(gp.getByText("Waiting for HQ to confirm")).toBeVisible();

  await ops.goto("/ops/restocks?f=pay");
  await ops.locator("li", { hasText: rs }).getByRole("button", { name: "Payment received" }).click();
  await expect(ops.locator("li", { hasText: rs }).getByText(/Paid \d/)).toBeVisible();
  const hqBefore = (await stockOf("hq", 50)).onHand;
  await ops.goto("/ops/restocks?f=send");
  await ops.locator("li", { hasText: rs }).getByRole("button", { name: "Dispatch" }).click();
  await expect(ops.locator("li", { hasText: rs }).getByText(/Dispatched \d/)).toBeVisible();
  const sent = hqBefore - (await stockOf("hq", 50)).onHand;
  expect(sent).toBeGreaterThanOrEqual(5); // 5 bought + any free replacement bags owed

  const govaBefore = (await stockOf("gova-max-ltd", 50)).onHand;
  await gp.goto("/partner/stock");
  await gp.getByRole("button", { name: "Confirm received" }).click();
  await expect(gp.getByText("Last delivery from HQ")).toBeVisible();
  expect((await stockOf("gova-max-ltd", 50)).onHand).toBe(govaBefore + sent);
  expect((await db.restockOrder.findUniqueOrThrow({ where: { number: rs } })).status).toBe("RECEIVED");
});

import { expect, test } from "@playwright/test";
import { db, zoneId } from "./db";
import { acceptDialogs, chooseArea, loginWithCode, newPhone, signInAs } from "./helpers";

test("order from an HQ area, sign in with an SMS code, pay by transfer, HQ confirms", async ({ page, browser }) => {
  await page.context().addInitScript(() => localStorage.setItem("nsr_consent", "denied"));
  await page.goto("/");
  await chooseArea(page, await zoneId("Garki"));
  await page.goto("/p/naija-sweet-rice?size=50");
  await expect(page.getByText("Sold by")).toContainText("Naija Sweet Rice HQ");
  await expect(page.getByText("₦85,000").first()).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("link", { name: /Cart, 1 item/ })).toBeVisible();

  await page.goto("/cart");
  await expect(page.locator("aside")).toContainText("Delivered by Naija Sweet Rice HQ");
  await page.getByRole("link", { name: "Checkout" }).click();
  const phone = newPhone();
  await loginWithCode(page, phone);
  await page.getByLabel("Full name").fill("Ngozi Eze");
  await page.getByLabel("Street address").fill("14 Ahmadu Bello Way, Garki");
  await page.getByRole("button", { name: /^Pay ₦/ }).click();

  await page.waitForURL(/\/orders\/NSR-/);
  const number = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { name: "Pay by bank transfer" })).toBeVisible();
  await expect(page.locator("section", { hasText: "Pay by bank transfer" })).toContainText("1012345678");
  await expect(page.locator("section", { hasText: "Pay by bank transfer" })).toContainText(number);
  await page.getByRole("button", { name: "I've made the transfer" }).click();
  await expect(page.getByText("Waiting for the seller to confirm")).toBeVisible();

  const hq = await browser.newContext();
  await signInAs(hq, "08011112222");
  const ops = await hq.newPage();
  acceptDialogs(ops);
  await ops.goto("/ops/orders?f=unpaid");
  const card = ops.locator("li", { hasText: number });
  await expect(card).toContainText("Customer says they transferred");
  await card.getByRole("button", { name: "Payment received" }).click();
  await expect(ops.locator("li", { hasText: number }).getByText("Transfer confirmed")).toBeVisible();

  const order = await db.order.findUniqueOrThrow({ where: { number } });
  expect(order.status).toBe("PAID");
  expect(order.distributorId).toBe("hq");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Payment confirmed" })).toBeVisible();
});

test("nearby towns enforce the minimum order", async ({ page }) => {
  await page.context().addInitScript(() => localStorage.setItem("nsr_consent", "denied"));
  await page.goto("/");
  await chooseArea(page, await zoneId("Suleja"));
  await page.goto("/p/naija-sweet-rice?size=25");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/cart");
  await expect(page.locator("main [role=alert]").filter({ hasText: "minimum" })).toContainText("50kg");
  await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
});

test("free 1kg sample with free pickup needs no payment", async ({ page }) => {
  await signInAs(page.context(), newPhone(), { name: "Chidi Okafor" });
  await page.goto("/samples");
  await page.locator("#zone").selectOption({ label: "Pickup at flagship store (free)" });
  await expect(page.getByText("Sent by Naija Sweet Rice HQ")).toBeVisible();
  await page.getByRole("button", { name: "Get my free sample" }).click();
  await page.waitForURL(/\/orders\/NSR-/);
  const order = await db.order.findUniqueOrThrow({ where: { number: page.url().split("/").pop()! } });
  expect(order).toMatchObject({ type: "SAMPLE", status: "PAID", totalKobo: 0 });
  await page.goto("/samples");
  await expect(page.getByText("You've requested your sample")).toBeVisible();
});

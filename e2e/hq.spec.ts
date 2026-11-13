import { expect, test } from "@playwright/test";
import { db } from "./db";
import { loginWithCode, newPhone, signInAs, statusText } from "./helpers";

test.describe.configure({ mode: "serial" });

test("customers can't open HQ screens", async ({ page }) => {
  await signInAs(page.context(), newPhone());
  await page.goto("/ops/prices");
  await expect(page.getByText("doesn't have HQ access")).toBeVisible();
});

test("the HQ owner signs in with an SMS code and manages the team; staff have limited access", async ({ page, browser }) => {
  await page.context().addInitScript(() => localStorage.setItem("nsr_consent", "denied"));
  await page.goto("/ops/login");
  await loginWithCode(page, "0801 111 2222"); // in HQ_OWNER_PHONES
  await page.waitForURL("**/ops/orders");
  await expect(page.getByRole("link", { name: "HQ team" })).toBeVisible();

  const staffPhone = newPhone();
  await page.goto("/ops/team");
  await page.getByLabel("Name").fill("Ada Obi");
  await page.getByLabel("Mobile number").fill(staffPhone);
  await page.getByRole("button", { name: "Give HQ access" }).click();
  await expect(statusText(page, /added as staff/)).toBeVisible();

  await page.getByLabel("Name").fill("Musa");
  await page.getByLabel("Mobile number").fill("08120003333"); // Gova Max owner
  await page.getByRole("button", { name: "Give HQ access" }).click();
  await expect(statusText(page, /distributor team/)).toBeVisible();

  const sctx = await browser.newContext();
  await signInAs(sctx, staffPhone);
  const staff = await sctx.newPage();
  await staff.goto("/ops/orders");
  await expect(staff.getByRole("heading", { name: "Orders" })).toBeVisible();
  await expect(staff.getByRole("link", { name: "HQ team" })).toHaveCount(0);
  await staff.goto("/ops/team");
  await expect(staff.getByText("That page is for HQ owners only.")).toBeVisible();
  const gova = await db.distributor.findUniqueOrThrow({ where: { slug: "gova-max-ltd" } });
  await staff.goto(`/ops/distributors/${gova.id}`);
  await expect(staff.getByText("Only HQ owners can change bank details.")).toBeVisible();
  await expect(staff.getByRole("button", { name: "Save bank details" })).toHaveCount(0);

  await page.reload();
  await page.locator("li", { hasText: "Ada Obi" }).getByRole("button", { name: "Remove" }).click();
  await expect(page.locator("li", { hasText: "Ada Obi" })).toHaveCount(0);
  await staff.goto("/ops/orders");
  await staff.waitForURL(/\/ops\/login/);
});

test("the network map shows who covers each area, with a table of the same facts", async ({ page, context }) => {
  await signInAs(context, "0801 111 2222", { name: "HQ Owner", roles: ["OWNER"] });
  await page.goto("/ops/network");
  await expect(page.getByRole("heading", { name: "Network map" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Schematic map of Abuja/ })).toBeVisible();
  const areas = page.locator("section", { hasText: "Served by" });
  await expect(areas.getByRole("row", { name: /^Gwarinpa Gova Max Ltd/ })).toBeVisible();
  await expect(areas.getByRole("row", { name: /^Garki HQ/ })).toBeVisible();
  await expect(areas.getByRole("row", { name: /^Suleja · min order HQ/ })).toBeVisible();
  if (process.env.E2E_SCREENSHOTS) await page.screenshot({ path: `${process.env.E2E_SCREENSHOTS}/network-mobile.png`, fullPage: true });
});

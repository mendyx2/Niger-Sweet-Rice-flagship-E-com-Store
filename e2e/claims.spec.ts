import { expect, test } from "@playwright/test";
import path from "node:path";
import { db, variantId, zoneId } from "./db";
import { newPhone, signInAs } from "./helpers";

test("a damaged bag: customer sends photos, HQ approves, the distributor sends a free replacement", async ({ page, browser }) => {
  const customer = await signInAs(page.context(), newPhone(), { name: "Bisi Ade" });
  const gova = await db.distributor.findUniqueOrThrow({ where: { slug: "gova-max-ltd" } });
  const v50 = await variantId(50);
  // A delivered Gova order (created directly; the buying flow is covered in distributor.spec).
  const order = await db.order.create({
    data: {
      number: `NSR-T${Date.now().toString(36).toUpperCase().slice(-5)}`, userId: customer.id, customerName: "Bisi Ade", contactPhone: customer.phone,
      zoneId: await zoneId("Gwarinpa"), addressSnapshot: { street: "5 Gwarinpa Ave", landmark: null, zoneName: "Gwarinpa" },
      distributorId: gova.id, status: "DELIVERED", paidAt: new Date(), deliveredAt: new Date(), paymentMethod: "BANK_TRANSFER",
      subtotalKobo: 8_400_000, deliveryFeeKobo: 250_000, totalKobo: 8_650_000,
      items: { create: { variantId: v50, qty: 1, unitPriceKobo: 8_400_000, sizeKg: 50 } },
    },
  });

  await page.goto(`/orders/${order.number}`);
  await page.getByRole("link", { name: /Request a replacement/ }).click();
  await page.getByLabel("Bag is torn or burst").check();
  await page.getByLabel("Tell us more").fill("The bag arrived with a long tear at the seam.");
  await page.locator("input[type=file]").setInputFiles(path.join(__dirname, "files/torn-bag.jpg"));
  await expect(page.getByRole("img", { name: "Photo 1" })).toBeVisible();
  await page.getByRole("button", { name: "Request replacement" }).click();
  await expect(page.getByText("We've received your request")).toBeVisible();

  const claim = await db.returnClaim.findFirstOrThrow({ where: { orderId: order.id }, include: { photos: true } });
  expect(claim.photos).toHaveLength(1);
  expect(claim.photos[0].mime).toBe("image/jpeg");
  // Photos are private
  const anon = await (await browser.newContext()).request.get(`/api/claim-photos/${claim.photos[0].id}`);
  expect(anon.status()).toBe(404);

  const hctx = await browser.newContext();
  await signInAs(hctx, "08011112222");
  const ops = await hctx.newPage();
  await ops.goto("/ops/returns");
  await ops.locator("li", { hasText: order.number }).getByRole("button", { name: "Approve replacement" }).click();
  await expect(ops.locator("li", { hasText: order.number }).getByText(/Replacement order: NSR-/)).toBeVisible();
  const replacement = await db.order.findFirstOrThrow({ where: { parentOrderId: order.id } });
  expect(replacement).toMatchObject({ type: "REPLACEMENT", distributorId: gova.id, status: "PAID", totalKobo: 0 });
});

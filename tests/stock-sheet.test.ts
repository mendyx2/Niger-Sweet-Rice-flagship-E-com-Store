import { describe, expect, it } from "vitest";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { normalizePem, serviceAccountJwt } from "@/lib/google-auth";
import { movementRow, stockRows } from "@/lib/stock-sheet-rows";

describe("Google service account JWT", () => {
  it("is a valid RS256 token with the right claims", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const jwt = serviceAccountJwt("sync@proj.iam.gserviceaccount.com", normalizePem(pem.replace(/\n/g, "\\n")), "scope-x", 1_000);
    const [h, c, sig] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(c, "base64url").toString())).toMatchObject({ iss: "sync@proj.iam.gserviceaccount.com", scope: "scope-x", iat: 1000, exp: 4600 });
    expect(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true);
  });
});

describe("stock sheet rows", () => {
  it("formats a movement in Lagos time with readable labels", () => {
    expect(movementRow({
      createdAt: new Date("2026-11-13T12:14:00Z"), distributor: { name: "Gova Max Ltd" }, variant: { sizeKg: 50 }, type: "WALK_IN_SALE",
      delta: -1, transitDelta: 0, onHandAfter: 7, status: "APPLIED", reference: null, actor: "partner:gova-max-ltd:cmx123", note: "Cash",
    })).toEqual(["2026-11-13 13:14", "Gova Max Ltd", "50kg", "Shop sale", -1, 0, 7, "Applied", "", "gova-max-ltd", "Cash"]);
  });
  it("computes days of stock left from the last 14 days of sales, HQ first", () => {
    const rows = stockRows([
      { distributor: { name: "Gova Max Ltd", isHq: false }, variant: { sizeKg: 50 }, onHand: 7, held: 0, inTransit: 0, sold14: 14 },
      { distributor: { name: "Naija Sweet Rice HQ", isHq: true }, variant: { sizeKg: 50 }, onHand: 30, held: 2, inTransit: 0, sold14: 0 },
    ], new Date("2026-11-13T12:00:00Z"));
    expect(rows[0].slice(0, 7)).toEqual(["Naija Sweet Rice HQ", "50kg", 30, 2, 0, 0, "no recent sales"]);
    expect(rows[1][6]).toBe(7);
  });
});

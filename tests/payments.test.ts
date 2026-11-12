import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { isValidPaystackSignature, orderNumberFromReference } from "@/lib/paystack-signature";
import { normalizeNgPhone, formatNgPhone, maskPhone } from "@/lib/phone";

describe("paystack webhook signature", () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "NSR-ABC234_1a2b3c4d" } });
  const sig = createHmac("sha512", "sk_test_x").update(body).digest("hex");
  it("accepts a correct signature", () => expect(isValidPaystackSignature(body, sig, "sk_test_x")).toBe(true));
  it("rejects tampering, wrong key and missing values", () => {
    expect(isValidPaystackSignature(body + " ", sig, "sk_test_x")).toBe(false);
    expect(isValidPaystackSignature(body, sig, "sk_test_y")).toBe(false);
    expect(isValidPaystackSignature(body, null, "sk_test_x")).toBe(false);
    expect(isValidPaystackSignature(body, sig, "")).toBe(false);
    expect(isValidPaystackSignature(body, "abc", "sk_test_x")).toBe(false);
  });
  it("extracts the order number from our reference format only", () => {
    expect(orderNumberFromReference("NSR-ABC234_1a2b3c4d")).toBe("NSR-ABC234");
    expect(orderNumberFromReference("NSR-ABC234")).toBeNull();
    expect(orderNumberFromReference("x_NSR-ABC234_1a2b")).toBeNull();
  });
});

describe("Nigerian phone numbers", () => {
  it("normalises common formats to E.164", () => {
    for (const s of ["08012345678", "0801 234 5678", "+234 801 234 5678", "2348012345678", "8012345678", "0901-234-5678"]) {
      expect(normalizeNgPhone(s)).toMatch(/^\+234[89]0\d{8}$/);
    }
    expect(normalizeNgPhone("07012345678")).toBe("+2347012345678");
  });
  it("rejects non-mobile and malformed numbers", () => {
    for (const s of ["", "0801234567", "080123456789", "06012345678", "abc", "+1 415 555 0100", "0802345678x"]) {
      expect(normalizeNgPhone(s)).toBeNull();
    }
  });
  it("formats and masks for display", () => {
    expect(formatNgPhone("+2348012345678")).toBe("0801 234 5678");
    expect(maskPhone("+2348012345678")).toBe("0801 *** 5678");
  });
});

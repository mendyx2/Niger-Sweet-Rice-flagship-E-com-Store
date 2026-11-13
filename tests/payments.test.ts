import { describe, expect, it } from "vitest";
import { normalizeNgPhone, formatNgPhone, maskPhone } from "@/lib/phone";

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

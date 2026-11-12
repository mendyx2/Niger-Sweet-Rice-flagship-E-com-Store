import { describe, expect, it } from "vitest";
import { formatNaira, koboToNairaInput, nairaToKobo, perKgKobo } from "@/lib/money";

describe("money", () => {
  it("formats kobo as whole naira", () => {
    expect(formatNaira(125_000_000)).toMatch(/1,250,000/);
    expect(formatNaira(125_000_000)).toContain("₦");
  });
  it("parses staff-entered naira amounts", () => {
    expect(nairaToKobo("45,000")).toBe(4_500_000);
    expect(nairaToKobo("₦ 45000.5")).toBe(4_500_050);
    expect(nairaToKobo("")).toBeNull();
    expect(nairaToKobo("12abc")).toBeNaN();
    expect(nairaToKobo("-5")).toBeNaN();
    expect(nairaToKobo("1.234")).toBeNaN();
  });
  it("round-trips to an input value", () => {
    expect(koboToNairaInput(4_500_000)).toBe("45000");
    expect(koboToNairaInput(4_500_050)).toBe("45000.50");
    expect(koboToNairaInput(null)).toBe("");
  });
  it("computes price per kg", () => {
    expect(perKgKobo(8_500_000, 50)).toBe(170_000);
  });
});

import { describe, expect, it } from "vitest";
import { makeLinkCode, readLinkCode } from "@/lib/telegram-codes";

const SECRET = "test-secret-test-secret-test-secret";
describe("Telegram link codes", () => {
  it("round-trips for a person and for HQ, within Telegram's limits", () => {
    const u = makeLinkCode({ userId: "cmwex7gax00097d2mv0hepqog" }, SECRET, 0);
    expect(u.length).toBeLessThanOrEqual(64);
    expect(u).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(readLinkCode(u, SECRET, 1000)).toEqual({ userId: "cmwex7gax00097d2mv0hepqog" });
    expect(readLinkCode(makeLinkCode("hq", SECRET, 0), SECRET, 1000)).toBe("hq");
  });
  it("rejects tampered, foreign and expired codes", () => {
    const u = makeLinkCode({ userId: "cmwex7gax00097d2mv0hepqog" }, SECRET, 0);
    expect(readLinkCode(u.replace("cmwex7", "cmwex8"), SECRET, 1000)).toBeNull();
    expect(readLinkCode(u, "another-secret-another-secret-xx", 1000)).toBeNull();
    expect(readLinkCode(u, SECRET, 2 * 3600_000)).toBeNull();
    expect(readLinkCode("hq-zzzz-0000000000000000", SECRET, 0)).toBeNull();
    expect(readLinkCode("garbage", SECRET, 0)).toBeNull();
  });
});

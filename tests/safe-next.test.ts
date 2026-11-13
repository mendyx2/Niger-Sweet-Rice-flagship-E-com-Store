import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext (where to go after signing in)", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/partner/stock")).toBe("/partner/stock");
    expect(safeNext("/orders/NSR-ABC123?x=1#top")).toBe("/orders/NSR-ABC123?x=1#top");
  });
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "\\evil.com", "javascript:alert(1)", "", null])(
    "refuses %j",
    (bad) => expect(safeNext(bad as string | null, "/account")).toBe("/account"),
  );
});

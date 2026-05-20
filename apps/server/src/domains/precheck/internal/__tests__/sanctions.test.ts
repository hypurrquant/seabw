import { describe, expect, test } from "vitest";
import { isSanctioned, sanctionsCount } from "../sanctions";

describe("isSanctioned", () => {
  test("returns false for empty/null", () => {
    expect(isSanctioned(undefined)).toBe(false);
    expect(isSanctioned(null)).toBe(false);
    expect(isSanctioned("")).toBe(false);
  });

  test("case-insensitive match against a known OFAC entry", () => {
    const tornado = "0x722122df12d4e14e13ac3b6895a86e84145b6967";
    expect(isSanctioned(tornado)).toBe(true);
    expect(isSanctioned(tornado.toUpperCase())).toBe(true);
    expect(isSanctioned("0x722122DF12D4E14E13AC3B6895A86E84145B6967")).toBe(true);
  });

  test("random address is not sanctioned", () => {
    expect(isSanctioned("0x000000000000000000000000000000000000abcd")).toBe(false);
  });

  test("Blender.io and Sinbad.io are included", () => {
    expect(isSanctioned("0x35fb6f6db4fb05e6a4ce86f2c93691425626d4b1")).toBe(true);
    expect(isSanctioned("0xf60dd140cff0706bae9cd734ac3ae76ad9ebc32a")).toBe(true);
  });

  test("sanctionsCount reports a non-trivial snapshot", () => {
    expect(sanctionsCount()).toBeGreaterThanOrEqual(20);
  });
});

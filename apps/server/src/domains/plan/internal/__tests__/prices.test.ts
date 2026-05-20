import { describe, expect, test } from "vitest";
import { priceMap, priceMapSync, usdPrice } from "../prices";

describe("usdPrice", () => {
  test("stablecoins resolve to $1 without RPC", async () => {
    expect(await usdPrice("USDC")).toBe(1);
    expect(await usdPrice("usdc")).toBe(1);
    expect(await usdPrice("DAI")).toBe(1);
  });

  test("ETH falls back to STATIC value when defi-cli is off", async () => {
    const p = await usdPrice("ETH");
    expect(p).toBeGreaterThan(1000);
  });

  test("unknown symbol returns 0", async () => {
    expect(await usdPrice("ZZZUNKNOWNZ")).toBe(0);
  });
});

describe("priceMap", () => {
  test("returns map with stablecoins=1 and uppercased keys", async () => {
    const m = await priceMap(["usdc", "ETH"]);
    expect(m["USDC"]).toBe(1);
    expect(m["ETH"]).toBeGreaterThan(0);
  });

  test("deduplicates input symbols", async () => {
    const m = await priceMap(["USDC", "usdc", "USDC"]);
    expect(Object.keys(m)).toHaveLength(1);
  });
});

describe("priceMapSync", () => {
  test("stablecoins resolve immediately", () => {
    const m = priceMapSync(["USDC", "USDT", "DAI"]);
    expect(m["USDC"]).toBe(1);
    expect(m["USDT"]).toBe(1);
    expect(m["DAI"]).toBe(1);
  });

  test("static fallback for ETH", () => {
    const m = priceMapSync(["ETH"]);
    expect(m["ETH"]).toBeGreaterThan(1000);
  });

  test("unknown symbol gets 0", () => {
    const m = priceMapSync(["WEIRDSYM"]);
    expect(m["WEIRDSYM"]).toBe(0);
  });
});

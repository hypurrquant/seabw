import { describe, expect, test } from "vitest";
import { rateLimit } from "@/lib/ratelimit";

describe("rateLimit", () => {
  test("first call allowed; remaining decreases", () => {
    const a = rateLimit("k-first", 3, 60_000);
    expect(a.allowed).toBe(true);
    expect(a.remaining).toBe(2);
    const b = rateLimit("k-first", 3, 60_000);
    expect(b.remaining).toBe(1);
    const c = rateLimit("k-first", 3, 60_000);
    expect(c.remaining).toBe(0);
    const d = rateLimit("k-first", 3, 60_000);
    expect(d.allowed).toBe(false);
    expect(d.retryAfterMs).toBeGreaterThan(0);
  });

  test("different keys are isolated", () => {
    rateLimit("k-iso-a", 1, 60_000);
    expect(rateLimit("k-iso-a", 1, 60_000).allowed).toBe(false);
    expect(rateLimit("k-iso-b", 1, 60_000).allowed).toBe(true);
  });

  test("window roll-over resets count", async () => {
    const k = "k-roll";
    rateLimit(k, 1, 10);
    expect(rateLimit(k, 1, 10).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(rateLimit(k, 1, 10).allowed).toBe(true);
  });
});

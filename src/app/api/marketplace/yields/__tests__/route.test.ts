import { describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/marketplace/yields/route";

function req(tier?: string, ipSuffix = "1"): NextRequest {
  const url = new URL("http://test.local/api/marketplace/yields");
  if (tier) url.searchParams.set("tier", tier);
  return new NextRequest(url, {
    method: "GET",
    headers: { "x-forwarded-for": `10.50.${Math.random().toString().slice(2, 5)}.${ipSuffix}` },
  });
}

describe("GET /api/marketplace/yields", () => {
  test("returns the conservative tier subset", async () => {
    const res = await GET(req("conservative"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tier).toBe("conservative");
    expect(data.products.length).toBeGreaterThan(0);
    expect(data.products.every((p: { kind: string }) => p.kind === "lending")).toBe(true);
  });

  test("balanced returns more than conservative", async () => {
    const c = await (await GET(req("conservative"))).json();
    const b = await (await GET(req("balanced"))).json();
    expect(b.products.length).toBeGreaterThan(c.products.length);
  });

  test("degen returns most pools", async () => {
    const a = await (await GET(req("aggressive"))).json();
    const d = await (await GET(req("degen"))).json();
    expect(d.products.length).toBeGreaterThanOrEqual(a.products.length);
  });

  test("missing tier returns 400", async () => {
    const res = await GET(req());
    expect(res.status).toBe(400);
  });

  test("invalid tier returns 400", async () => {
    const res = await GET(req("retired"));
    expect(res.status).toBe(400);
  });
});

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TierSchema } from "@/schemas";
import { liveCatalogForTier } from "@/lib/yields";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  tier: TierSchema,
});

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const rate = rateLimit(`yields:${clientIp(req)}`, 30, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ tier: url.searchParams.get("tier") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing or invalid tier" }, { status: 400 });
  }
  const catalog = await liveCatalogForTier(parsed.data.tier);
  return NextResponse.json({
    tier: parsed.data.tier,
    count: catalog.length,
    products: catalog,
  });
}

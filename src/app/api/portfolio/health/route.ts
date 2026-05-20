import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lpPositions, portfolioShow } from "@/lib/defiCli";
import { classifyPortfolio, type PortfolioHealth } from "@/lib/risk";
import { rateLimit } from "@/lib/ratelimit";
import { CHAINS, DEFI_CLI_CHAIN_IDS, isDefiCliChain } from "@/config/chains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.coerce.number().int().positive(),
});

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const rate = rateLimit(`portfolio:${clientIp(req)}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    address: url.searchParams.get("address"),
    chainId: url.searchParams.get("chainId"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid address or chainId", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { address, chainId } = parsed.data;
  if (!isDefiCliChain(chainId)) {
    return NextResponse.json(
      {
        error: `Chain ${chainId} not supported. Use one of: ${[...DEFI_CLI_CHAIN_IDS].join(", ")}`,
      },
      { status: 400 },
    );
  }

  try {
    const [show, lps] = await Promise.all([
      portfolioShow(chainId, address),
      lpPositions(chainId, address),
    ]);
    const health: PortfolioHealth = classifyPortfolio(
      show,
      lps,
      chainId,
      CHAINS[chainId]?.name ?? `Chain ${chainId}`,
    );
    return NextResponse.json({ health });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Failed to read portfolio: " + ((err as Error).message ?? "unknown").split("\n")[0],
      },
      { status: 502 },
    );
  }
}

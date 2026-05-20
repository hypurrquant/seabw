import { price as defiPrice, DefiCliError, isDefiCliAvailable } from "../../../lib/defi-cli";
import { isStablecoin } from "@seabw/core";

interface CacheEntry {
  value: number;
  fetchedAt: number;
}

const TTL_MS = 60_000;
const CACHE = new Map<string, CacheEntry>();

const STATIC_FALLBACK: Record<string, number> = {
  ETH: 3200,
  WETH: 3200,
  CBETH: 3200,
  BTC: 96_000,
  WBTC: 96_000,
  CBBTC: 96_000,
  HYPE: 12,
  MNT: 0.8,
  BNB: 700,
  MON: 1,
};

function cacheKey(symbol: string, chainId?: number): string {
  return `${symbol.toUpperCase()}::${chainId ?? "any"}`;
}

export async function usdPrice(
  symbol: string,
  chainId?: number,
  signal?: AbortSignal,
): Promise<number> {
  const sym = symbol.toUpperCase();
  if (isStablecoin(sym)) return 1;
  const k = cacheKey(sym, chainId);
  const hit = CACHE.get(k);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.value;

  if (isDefiCliAvailable()) {
    try {
      const v = await defiPrice(sym, chainId, signal);
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        CACHE.set(k, { value: v, fetchedAt: Date.now() });
        return v;
      }
    } catch (err) {
      if (!(err instanceof DefiCliError)) throw err;
      // fall through to static
    }
  }
  const stat = STATIC_FALLBACK[sym];
  if (stat) return stat;
  return 0;
}

export async function priceMap(
  symbols: string[],
  chainId?: number,
  signal?: AbortSignal,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(
    Array.from(new Set(symbols.map((s) => s.toUpperCase()))).map(async (s) => {
      out[s] = await usdPrice(s, chainId, signal);
    }),
  );
  return out;
}

export function priceMapSync(symbols: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of new Set(symbols.map((x) => x.toUpperCase()))) {
    if (isStablecoin(s)) {
      out[s] = 1;
      continue;
    }
    out[s] = STATIC_FALLBACK[s] ?? 0;
  }
  return out;
}

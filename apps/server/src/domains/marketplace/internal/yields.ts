import type { RiskTag, Tier } from "@seabw/core";
import type { YieldProduct, YieldProductKind } from "@seabw/core";
import {
  NAMED_AUDITORS,
  PROTOCOLS,
  whitelistFor,
  type ProtocolEntry,
} from "../../plan/internal/whitelist";
import { isDefiCliAvailable, yieldScan } from "../../../lib/defi-cli";

// Per-interface base APR + reward priors used when defi-cli is unavailable.
// All values are documented illustrative ranges, not promises.
const INTERFACE_APR: Record<
  string,
  { lending: [number, number]; dex: [number, number]; vault: [number, number] }
> = {
  aave_v3:           { lending: [3, 7],  dex: [0, 0],     vault: [0, 0] },
  compound_v3:       { lending: [2, 6],  dex: [0, 0],     vault: [0, 0] },
  compound_v2:       { lending: [2, 5],  dex: [0, 0],     vault: [0, 0] },
  morpho_blue:       { lending: [4, 9],  dex: [0, 0],     vault: [0, 0] },
  uniswap_v3:        { lending: [0, 0],  dex: [12, 35],   vault: [0, 0] },
  uniswap_v2:        { lending: [0, 0],  dex: [6, 18],    vault: [0, 0] },
  curve_stableswap:  { lending: [0, 0],  dex: [4, 10],    vault: [0, 0] },
  solidly_v2:        { lending: [0, 0],  dex: [15, 60],   vault: [0, 0] },
  algebra_v3:        { lending: [0, 0],  dex: [10, 45],   vault: [0, 0] },
  beefy_vault:       { lending: [0, 0],  dex: [0, 0],     vault: [8, 30] },
  hybra:             { lending: [0, 0],  dex: [20, 80],   vault: [0, 0] },
};

function categoryToKind(p: ProtocolEntry): YieldProductKind {
  if (p.category === "lending") return "lending";
  if (p.category === "vault") return "vault";
  if (p.emissionFarm) return "farm";
  return "lp";
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

function rand(seed: number, lo: number, hi: number): number {
  const x = ((seed * 9301 + 49297) % 233280) / 233280;
  return lo + x * (hi - lo);
}

function aprFor(p: ProtocolEntry, kind: YieldProductKind, seed: number): {
  basePct: number;
  rewardPct: number;
  varianceBps: number;
} {
  const range = INTERFACE_APR[p.iface] ?? { lending: [1, 4], dex: [3, 15], vault: [2, 10] };
  let basePct = 0;
  if (kind === "lending") basePct = rand(seed, range.lending[0], range.lending[1]);
  else if (kind === "vault") basePct = rand(seed, range.vault[0], range.vault[1]);
  else basePct = rand(seed, range.dex[0], range.dex[1]);
  const rewardPct = p.emissionFarm ? rand(seed + 1, 5, 35) : 0;
  const variance = Math.round(
    (kind === "lending" ? 50 : kind === "vault" ? 150 : 400) +
      rand(seed + 2, 0, 200),
  );
  return { basePct: round1(basePct), rewardPct: round1(rewardPct), varianceBps: variance };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function inputsOutputsFor(p: ProtocolEntry, kind: YieldProductKind): { inputs: string[]; outputs: string[]; label: string } {
  if (kind === "lending") return { inputs: ["USDC"], outputs: [`a${p.slug.startsWith("compound") ? "c" : ""}USDC`], label: "USDC supply" };
  if (kind === "vault") return { inputs: ["USDC"], outputs: [`${p.slug}-share`], label: "USDC vault" };
  // LP / farm — default ETH-stable pair where applicable, else stables
  const isStablesOnly = p.iface === "curve_stableswap";
  if (isStablesOnly) return { inputs: ["USDC", "USDT"], outputs: [`${p.slug}-LP`], label: "USDC/USDT LP" };
  const nativePair: Record<number, [string, string]> = {
    1: ["ETH", "USDC"],
    8453: ["ETH", "USDC"],
    56: ["BNB", "USDT"],
    5000: ["MNT", "USDC"],
    999: ["HYPE", "USDC"],
    143: ["MON", "USDC"],
  };
  const pair = nativePair[p.chainIds[0]] ?? ["ETH", "USDC"];
  return { inputs: [...pair], outputs: [`${p.slug}-LP`], label: `${pair[0]}/${pair[1]} LP` };
}

function riskTagsFor(p: ProtocolEntry, kind: YieldProductKind, hasNamedAudit: boolean): RiskTag[] {
  const out: RiskTag[] = [];
  if (kind === "lp" || kind === "farm") out.push("IL");
  if (kind === "farm" || p.emissionFarm) {
    // emission-only farms are flagged via fresh-pool if pool is also fresh
  }
  if (p.leveragedFarm) out.push("leverage");
  if (p.freshPool) out.push("fresh-pool");
  if (!hasNamedAudit) out.push("non-audited");
  return out;
}

function productFor(p: ProtocolEntry, chainId: number): YieldProduct {
  const kind = categoryToKind(p);
  const seed = hashSeed(`${chainId}:${p.slug}:${p.iface}`);
  const apr = aprFor(p, kind, seed);
  const { inputs, outputs, label } = inputsOutputsFor(p, kind);
  const hasNamedAudit = p.audits.some((a) => NAMED_AUDITORS.has(a));
  const totalPct = round1(apr.basePct + apr.rewardPct);
  return {
    id: `${chainId}:${p.slug}:default`,
    protocolSlug: p.slug,
    protocolName: p.name,
    iface: p.iface,
    chainId,
    kind,
    poolLabel: label,
    inputs,
    outputs,
    apr: {
      basePct: apr.basePct,
      rewardPct: apr.rewardPct,
      totalPct,
      varianceBps: apr.varianceBps,
      emissionExpiresAt: apr.rewardPct > 0
        ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString()
        : undefined,
    },
    tvlUsd: p.tvlUsd,
    ageDays: p.ageDays,
    auditCount: p.audits.length,
    audits: p.audits,
    risks: riskTagsFor(p, kind, hasNamedAudit),
    lockupDays: 0,
    minDepositUsd: 10,
  };
}

// Interfaces and slugs we cannot yet hydrate live via defi-cli without extra
// params or due to known simulation failures. They stay in the whitelist for
// policy scoring but are hidden from the marketplace UI so users only see
// products we can build executable plans for.
//
// ifaces: blocked by interface family (affects all protocols of that type)
//   - morpho_blue: requires --market <marketId> (32-byte hex) not yet catalogued
//
// slugs: blocked by individual protocol slug
//   - venus-bnb, venus-flux-bnb: compound_v2 iface — simulation reverts
//     (no ERC-20 approve flow; venus-flux-bnb also has invalid contract checksum)
//   - merchantmoe-mantle: Merchant Moe LB requires --pool <address> not catalogued
//   - traderjoe-monad: TraderJoe LB requires --pool <address> not catalogued
//   - uniswap-v3-bnb: position manager address not configured in defi-cli
const LIVE_HYDRATION_BLOCKLIST: Readonly<{ ifaces: ReadonlySet<string>; slugs: ReadonlySet<string> }> = {
  ifaces: new Set([
    "morpho_blue",
  ]),
  slugs: new Set([
    "venus-bnb",          // compound_v2: simulation reverts (no approve flow)
    "venus-flux-bnb",     // compound_v2: simulation reverts + invalid contract checksum
    "merchantmoe-mantle", // LB: needs --pool <address> not catalogued
    "traderjoe-monad",    // LB: needs --pool <address> not catalogued
    "uniswap-v3-bnb",     // position manager address not configured in defi-cli
  ]),
};

function liveHydratable(p: ProtocolEntry): boolean {
  return !LIVE_HYDRATION_BLOCKLIST.ifaces.has(p.iface) &&
    !LIVE_HYDRATION_BLOCKLIST.slugs.has(p.slug);
}

export function catalogForTier(tier: Tier): YieldProduct[] {
  const out: YieldProduct[] = [];
  for (const p of PROTOCOLS) {
    if (!liveHydratable(p)) continue;
    for (const chainId of p.chainIds) {
      if (!whitelistFor(tier, chainId).some((x) => x.slug === p.slug)) continue;
      out.push(productFor(p, chainId));
    }
  }
  return out;
}

export function catalogAll(): YieldProduct[] {
  const out: YieldProduct[] = [];
  for (const p of PROTOCOLS) {
    if (!liveHydratable(p)) continue;
    for (const chainId of p.chainIds) {
      out.push(productFor(p, chainId));
    }
  }
  return out;
}

// A — return top-N products similar to `seed` (same kind, same chain), ranked
// by TVL desc. Seed itself is always included if it qualifies. Used by the
// composer when the user opts into multi-pool diversification.
export function similarPools(seed: YieldProduct, n: number): YieldProduct[] {
  const all = catalogAll();
  const candidates = all
    .filter((p) => p.chainId === seed.chainId && p.kind === seed.kind && p.id !== seed.id)
    .sort((a, b) => b.tvlUsd - a.tvlUsd);
  return [seed, ...candidates].slice(0, Math.max(1, n));
}

// Best-effort live refresh: replace APRs with defi-cli's yield scan when
// the binary is available. Falls back to catalog priors otherwise.
export async function liveCatalogForTier(tier: Tier): Promise<YieldProduct[]> {
  const base = catalogForTier(tier);
  if (!isDefiCliAvailable()) return base;
  const byChain: Record<number, Awaited<ReturnType<typeof yieldScan>>> = {};
  const chainIds = Array.from(new Set(base.map((p) => p.chainId)));
  await Promise.all(
    chainIds.map(async (cid) => {
      try {
        byChain[cid] = await yieldScan(cid, { kind: "all" });
      } catch {
        byChain[cid] = [];
      }
    }),
  );
  return base.map((p) => {
    const rows = byChain[p.chainId] ?? [];
    const match = rows.find(
      (r) => r.protocol?.toLowerCase() === p.protocolSlug.toLowerCase(),
    );
    if (!match) return p;
    const total = round1(match.apr ?? match.apy ?? p.apr.totalPct);
    return {
      ...p,
      apr: { ...p.apr, totalPct: total, basePct: total - p.apr.rewardPct },
      tvlUsd: match.tvl_usd ?? p.tvlUsd,
    };
  });
}

import type { Tier } from "@/types";

export type ProtocolCategory =
  | "dex"
  | "lending"
  | "lp"
  | "farm"
  | "bridge"
  | "leverage"
  | "perp"
  | "vault";

export interface ProtocolEntry {
  slug: string;                  // defi-cli slug — primary key
  name: string;
  category: ProtocolCategory;
  chainIds: number[];
  iface: string;                 // defi-cli interface family
  audits: string[];
  tvlUsd: number;                // last-known TVL, approximate
  ageDays: number;               // days since mainnet launch
  emissionFarm?: boolean;
  leveragedFarm?: boolean;
  freshPool?: boolean;
}

// Trust priors keyed by defi-cli interface family. Used as defaults when a
// protocol does not have its own audit/TVL data overridden below.
const INTERFACE_PRIOR: Record<
  string,
  { audits: string[]; tvlUsd: number; ageDays: number }
> = {
  aave_v3:           { audits: ["Trail of Bits", "OpenZeppelin", "Spearbit"], tvlUsd: 250_000_000, ageDays: 700 },
  compound_v3:       { audits: ["OpenZeppelin", "ChainSecurity"],             tvlUsd: 200_000_000, ageDays: 700 },
  compound_v2:       { audits: ["OpenZeppelin"],                              tvlUsd: 100_000_000, ageDays: 1500 },
  morpho_blue:       { audits: ["Spearbit", "Cantina"],                       tvlUsd: 200_000_000, ageDays: 500 },
  uniswap_v3:        { audits: ["Trail of Bits", "Cantina"],                  tvlUsd: 300_000_000, ageDays: 1500 },
  uniswap_v2:        { audits: ["Runtime Verification"],                      tvlUsd: 50_000_000, ageDays: 1700 },
  curve_stableswap:  { audits: ["Trail of Bits", "ChainSecurity"],            tvlUsd: 100_000_000, ageDays: 1500 },
  solidly_v2:        { audits: ["Code4rena", "Spearbit"],                     tvlUsd: 80_000_000, ageDays: 600 },
  algebra_v3:        { audits: ["Pessimistic"],                               tvlUsd: 20_000_000, ageDays: 400 },
  beefy_vault:       { audits: ["Halborn", "Pessimistic"],                    tvlUsd: 80_000_000, ageDays: 1200 },
  hybra:             { audits: [],                                            tvlUsd: 5_000_000,  ageDays: 90 },
};

// Per-protocol overrides. Anything not listed here inherits INTERFACE_PRIOR.
const OVERRIDES: Partial<Record<string, Partial<ProtocolEntry>>> = {
  "aave-v3-base":     { tvlUsd: 1_500_000_000, ageDays: 900 },
  "aave-v3-bnb":      { tvlUsd: 1_000_000_000, ageDays: 800 },
  "aave-v3-mantle":   { tvlUsd: 60_000_000,    ageDays: 400 },
  "compound-v3-base": { tvlUsd: 250_000_000,   ageDays: 600 },
  "uniswap-v3-base":  { tvlUsd: 1_800_000_000, ageDays: 700 },
  "uniswap-v3-bnb":   { tvlUsd: 350_000_000,   ageDays: 700 },
  "uniswap-v3-mantle":{ tvlUsd: 35_000_000,    ageDays: 400 },
  "uniswap-v3-monad": { tvlUsd: 18_000_000,    ageDays: 60 },
  "uniswap-v2-monad": { tvlUsd: 10_000_000,    ageDays: 60 },
  "aerodrome-base":   { tvlUsd: 1_400_000_000, ageDays: 700, emissionFarm: true, category: "lp" },
  "aerodrome-cl":     { tvlUsd: 900_000_000,   ageDays: 500, emissionFarm: true, category: "lp" },
  "pancakeswap-v3-bnb":{ tvlUsd: 1_700_000_000, ageDays: 700 },
  "pancakeswap-v2-bnb":{ tvlUsd: 500_000_000,   ageDays: 1500 },
  "thena-fusion":     { tvlUsd: 50_000_000,    ageDays: 600, emissionFarm: true },
  "thena-v1":         { tvlUsd: 40_000_000,    ageDays: 800, emissionFarm: true },
  "venus-bnb":        { tvlUsd: 1_800_000_000, ageDays: 1500 },
  "venus-flux-bnb":   { tvlUsd: 200_000_000,   ageDays: 700 },
  "kinza-bnb":        { tvlUsd: 50_000_000,    ageDays: 500 },
  "felix-morpho":     { tvlUsd: 30_000_000,    ageDays: 180 },
  "hyperlend":        { tvlUsd: 200_000_000,   ageDays: 220 },
  "hypurrfi":         { tvlUsd: 90_000_000,    ageDays: 200 },
  "curve-hyperevm":   { tvlUsd: 25_000_000,    ageDays: 150 },
  "ramses-cl":        { tvlUsd: 15_000_000,    ageDays: 90, emissionFarm: true },
  "ramses-hl":        { tvlUsd: 8_000_000,     ageDays: 80, emissionFarm: true },
  "kittenswap":       { tvlUsd: 6_000_000,     ageDays: 110, emissionFarm: true },
  "project-x":        { tvlUsd: 12_000_000,    ageDays: 100, freshPool: false },
  "hyperswap-v3":     { tvlUsd: 80_000_000,    ageDays: 220 },
  "hybra":            { tvlUsd: 5_000_000,     ageDays: 90, freshPool: true },
  "morpho-blue-monad":{ tvlUsd: 12_000_000,    ageDays: 60 },
  "traderjoe-monad":  { tvlUsd: 8_000_000,     ageDays: 60, freshPool: true },
  "apeswap-bnb":      { tvlUsd: 18_000_000 },
  "babydogeswap-bnb": { tvlUsd: 4_000_000, audits: [] },
  "bakeryswap-bnb":   { tvlUsd: 8_000_000 },
  "biswap-bnb":       { tvlUsd: 12_000_000 },
  "bscswap-bnb":      { tvlUsd: 6_000_000, audits: [] },
  "fstswap-bnb":      { tvlUsd: 3_000_000, audits: [] },
  "merchantmoe-mantle":{ tvlUsd: 18_000_000,   ageDays: 400 },
  "beefy-bnb":        { tvlUsd: 60_000_000 },
};

interface RawProtocol {
  slug: string;
  name: string;
  category: ProtocolCategory;
  chainId: number;
  iface: string;
}

// Mirror of `defi --json status` flattened. Refresh by running:
//   pnpm exec defi --json status | jq '[ .[] | .protocols[] as $p | { slug:$p.slug, name:$p.name, category:$p.category, iface:$p.interface, chainId:.chain_id } ]'
const DEFI_CLI_PROTOCOLS: RawProtocol[] = [
  { slug: "curve-hyperevm",      name: "Curve HyperEVM",       category: "dex",     iface: "curve_stableswap", chainId: 999 },
  { slug: "hybra",               name: "Hybra",                category: "dex",     iface: "hybra",            chainId: 999 },
  { slug: "hyperswap-v3",        name: "HyperSwap V3",         category: "dex",     iface: "uniswap_v3",       chainId: 999 },
  { slug: "kittenswap",          name: "KittenSwap Algebra",   category: "dex",     iface: "algebra_v3",       chainId: 999 },
  { slug: "project-x",           name: "Project X",            category: "dex",     iface: "uniswap_v3",       chainId: 999 },
  { slug: "ramses-cl",           name: "Ramses CL",            category: "dex",     iface: "uniswap_v3",       chainId: 999 },
  { slug: "ramses-hl",           name: "Ramses HL",            category: "dex",     iface: "solidly_v2",       chainId: 999 },
  { slug: "felix-morpho",        name: "Felix Morpho",         category: "lending", iface: "morpho_blue",      chainId: 999 },
  { slug: "hyperlend",           name: "HyperLend",            category: "lending", iface: "aave_v3",          chainId: 999 },
  { slug: "hypurrfi",            name: "HypurrFi Pooled",      category: "lending", iface: "aave_v3",          chainId: 999 },
  { slug: "merchantmoe-mantle",  name: "Merchant Moe Mantle",  category: "dex",     iface: "uniswap_v2",       chainId: 5000 },
  { slug: "uniswap-v3-mantle",   name: "Uniswap V3 Mantle",    category: "dex",     iface: "uniswap_v3",       chainId: 5000 },
  { slug: "aave-v3-mantle",      name: "Aave V3 Mantle",       category: "lending", iface: "aave_v3",          chainId: 5000 },
  { slug: "aerodrome-base",      name: "Aerodrome",            category: "dex",     iface: "solidly_v2",       chainId: 8453 },
  { slug: "aerodrome-cl",        name: "Aerodrome Slipstream", category: "dex",     iface: "uniswap_v3",       chainId: 8453 },
  { slug: "uniswap-v3-base",     name: "Uniswap V3 Base",      category: "dex",     iface: "uniswap_v3",       chainId: 8453 },
  { slug: "aave-v3-base",        name: "Aave V3 Base",         category: "lending", iface: "aave_v3",          chainId: 8453 },
  { slug: "compound-v3-base",    name: "Compound V3 Base",     category: "lending", iface: "compound_v3",      chainId: 8453 },
  { slug: "apeswap-bnb",         name: "ApeSwap",              category: "dex",     iface: "uniswap_v2",       chainId: 56 },
  { slug: "babydogeswap-bnb",    name: "BabyDogeSwap",         category: "dex",     iface: "uniswap_v2",       chainId: 56 },
  { slug: "bakeryswap-bnb",      name: "BakerySwap",           category: "dex",     iface: "uniswap_v2",       chainId: 56 },
  { slug: "biswap-bnb",          name: "Biswap",               category: "dex",     iface: "uniswap_v2",       chainId: 56 },
  { slug: "bscswap-bnb",         name: "BSCSwap",              category: "dex",     iface: "uniswap_v2",       chainId: 56 },
  { slug: "fstswap-bnb",         name: "FstSwap",              category: "dex",     iface: "uniswap_v2",       chainId: 56 },
  { slug: "pancakeswap-v2-bnb",  name: "PancakeSwap V2",       category: "dex",     iface: "uniswap_v2",       chainId: 56 },
  { slug: "pancakeswap-v3-bnb",  name: "PancakeSwap V3 BNB",   category: "dex",     iface: "uniswap_v3",       chainId: 56 },
  { slug: "thena-fusion",        name: "Thena Fusion",         category: "dex",     iface: "algebra_v3",       chainId: 56 },
  { slug: "thena-v1",            name: "Thena V1",             category: "dex",     iface: "solidly_v2",       chainId: 56 },
  { slug: "uniswap-v3-bnb",      name: "Uniswap V3 BNB",       category: "dex",     iface: "uniswap_v3",       chainId: 56 },
  { slug: "aave-v3-bnb",         name: "Aave V3 BNB",          category: "lending", iface: "aave_v3",          chainId: 56 },
  { slug: "kinza-bnb",           name: "Kinza Finance",        category: "lending", iface: "aave_v3",          chainId: 56 },
  { slug: "venus-bnb",           name: "Venus",                category: "lending", iface: "compound_v2",      chainId: 56 },
  { slug: "venus-flux-bnb",      name: "Venus Flux",           category: "lending", iface: "compound_v2",      chainId: 56 },
  { slug: "beefy-bnb",           name: "Beefy BNB",            category: "vault",   iface: "beefy_vault",      chainId: 56 },
  { slug: "traderjoe-monad",     name: "Trader Joe Monad",     category: "dex",     iface: "uniswap_v2",       chainId: 143 },
  { slug: "uniswap-v2-monad",    name: "Uniswap V2 Monad",     category: "dex",     iface: "uniswap_v2",       chainId: 143 },
  { slug: "uniswap-v3-monad",    name: "Uniswap V3 Monad",     category: "dex",     iface: "uniswap_v3",       chainId: 143 },
  { slug: "morpho-blue-monad",   name: "Morpho Blue Monad",    category: "lending", iface: "morpho_blue",      chainId: 143 },
];

function buildEntry(p: RawProtocol): ProtocolEntry {
  const prior = INTERFACE_PRIOR[p.iface] ?? { audits: [], tvlUsd: 1_000_000, ageDays: 30 };
  const override = OVERRIDES[p.slug] ?? {};
  return {
    slug: p.slug,
    name: p.name,
    category: (override.category ?? p.category) as ProtocolCategory,
    chainIds: [p.chainId],
    iface: p.iface,
    audits: override.audits ?? prior.audits,
    tvlUsd: override.tvlUsd ?? prior.tvlUsd,
    ageDays: override.ageDays ?? prior.ageDays,
    emissionFarm: override.emissionFarm,
    leveragedFarm: override.leveragedFarm,
    freshPool: override.freshPool,
  };
}

export const PROTOCOLS: ProtocolEntry[] = DEFI_CLI_PROTOCOLS.map(buildEntry);

// §8.2 — the canonical audit firms accepted by the policy. Any audit string
// outside this set does NOT count toward the "at least one named audit"
// requirement.
export const NAMED_AUDITORS = new Set([
  "Trail of Bits",
  "OpenZeppelin",
  "Spearbit",
  "Code4rena",
  "Cantina",
  "Halborn",
  "Quantstamp",
]);

function hasNamedAudit(audits: string[]): boolean {
  return audits.some((a) => NAMED_AUDITORS.has(a));
}

interface TierFilter {
  minTvlUsd: number;
  minAgeDays: number;
  requireNamedAudit: boolean;
  allowFreshPool: boolean;
  allowLeverage: boolean;
  allowedCategories: ProtocolCategory[];
}

// §8.2 floors from PLAN.md — strict, no relaxation per tier below $10M.
// 5-tier model (KOFIA 일반투자자 분류) — preservation is strictest.
const TIER_FILTERS: Record<Tier, TierFilter> = {
  preservation: {
    minTvlUsd: 500_000_000,
    minAgeDays: 365,
    requireNamedAudit: true,
    allowFreshPool: false,
    allowLeverage: false,
    allowedCategories: ["lending"],
  },
  conservative: {
    minTvlUsd: 100_000_000,
    minAgeDays: 180,
    requireNamedAudit: true,
    allowFreshPool: false,
    allowLeverage: false,
    allowedCategories: ["lending"],
  },
  balanced: {
    minTvlUsd: 30_000_000,
    minAgeDays: 30,
    requireNamedAudit: true,
    allowFreshPool: false,
    allowLeverage: false,
    allowedCategories: ["lending", "dex", "lp", "bridge"],
  },
  aggressive: {
    minTvlUsd: 10_000_000,
    minAgeDays: 14,
    requireNamedAudit: true,
    allowFreshPool: false,
    allowLeverage: false,
    allowedCategories: ["lending", "dex", "lp", "farm", "bridge", "vault"],
  },
  degen: {
    minTvlUsd: 10_000_000,
    minAgeDays: 0,
    requireNamedAudit: false,
    allowFreshPool: true,
    allowLeverage: true,
    allowedCategories: [
      "lending",
      "dex",
      "lp",
      "farm",
      "bridge",
      "leverage",
      "perp",
      "vault",
    ],
  },
};

export function whitelistFor(tier: Tier, chainId: number): ProtocolEntry[] {
  const filter = TIER_FILTERS[tier];
  return PROTOCOLS.filter((p) => {
    if (!p.chainIds.includes(chainId)) return false;
    if (filter.requireNamedAudit && !hasNamedAudit(p.audits)) return false;
    if (p.tvlUsd < filter.minTvlUsd) return false;
    if (p.ageDays < filter.minAgeDays) return false;
    if (!filter.allowedCategories.includes(p.category)) return false;
    if (!filter.allowLeverage && p.leveragedFarm) return false;
    if (!filter.allowFreshPool && p.freshPool) return false;
    return true;
  });
}

export function isProtocolAllowed(
  tier: Tier,
  chainId: number,
  protocol: string,
): boolean {
  const target = protocol.toLowerCase();
  return whitelistFor(tier, chainId).some(
    (p) => p.slug.toLowerCase() === target || p.name.toLowerCase() === target,
  );
}

export function protocolDetails(slug: string): ProtocolEntry | undefined {
  const target = slug.toLowerCase();
  return PROTOCOLS.find(
    (p) => p.slug.toLowerCase() === target || p.name.toLowerCase() === target,
  );
}

export function bestLendingProtocol(tier: Tier, chainId: number): ProtocolEntry | undefined {
  return whitelistFor(tier, chainId)
    .filter((p) => p.category === "lending")
    .sort((a, b) => b.tvlUsd - a.tvlUsd)[0];
}

export function bestDexProtocol(tier: Tier, chainId: number): ProtocolEntry | undefined {
  return whitelistFor(tier, chainId)
    .filter((p) => p.category === "dex")
    .sort((a, b) => b.tvlUsd - a.tvlUsd)[0];
}

export function bestLpProtocol(tier: Tier, chainId: number): ProtocolEntry | undefined {
  return whitelistFor(tier, chainId)
    .filter((p) => p.category === "lp" || p.category === "dex")
    .sort((a, b) => {
      // Prefer emission farms for aggressive/degen, dex for balanced
      if (tier === "aggressive" || tier === "degen") {
        return (b.emissionFarm ? 1 : 0) - (a.emissionFarm ? 1 : 0) || b.tvlUsd - a.tvlUsd;
      }
      return b.tvlUsd - a.tvlUsd;
    })[0];
}

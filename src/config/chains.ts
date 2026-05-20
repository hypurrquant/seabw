export interface ChainSpec {
  id: number;
  name: string;
  shortName: string;
  defiCliKey: string;        // value to pass to `defi --chain <key>`
  rpcDefault: string;
  rpcEnvVar: string;         // env var name that can override
  nativeSymbol: string;
  isMajor: boolean;
  isMainnet: boolean;
  explorerTxUrl: (hash: string) => string;
  explorerAddressUrl: (addr: string) => string;
  privateRpcRequired: boolean;
}

export const CHAINS: Record<number, ChainSpec> = {
  1: {
    id: 1,
    name: "Ethereum",
    shortName: "ETH",
    defiCliKey: "ethereum",
    rpcDefault: "https://eth.llamarpc.com",
    rpcEnvVar: "NEXT_PUBLIC_ETHEREUM_RPC_URL",
    nativeSymbol: "ETH",
    isMajor: true,
    isMainnet: true,
    explorerTxUrl: (h) => `https://etherscan.io/tx/${h}`,
    explorerAddressUrl: (a) => `https://etherscan.io/address/${a}`,
    privateRpcRequired: true,
  },
  56: {
    id: 56,
    name: "BNB Chain",
    shortName: "BNB",
    defiCliKey: "bnb",
    rpcDefault: "https://bsc-dataseed1.binance.org",
    rpcEnvVar: "NEXT_PUBLIC_BNB_RPC_URL",
    nativeSymbol: "BNB",
    isMajor: true,
    isMainnet: true,
    explorerTxUrl: (h) => `https://bscscan.com/tx/${h}`,
    explorerAddressUrl: (a) => `https://bscscan.com/address/${a}`,
    privateRpcRequired: false,
  },
  143: {
    id: 143,
    name: "Monad",
    shortName: "MON",
    defiCliKey: "monad",
    rpcDefault: "https://rpc.monad.xyz",
    rpcEnvVar: "NEXT_PUBLIC_MONAD_RPC_URL",
    nativeSymbol: "MON",
    isMajor: true,
    isMainnet: true,
    explorerTxUrl: (h) => `https://explorer.monad.xyz/tx/${h}`,
    explorerAddressUrl: (a) => `https://explorer.monad.xyz/address/${a}`,
    privateRpcRequired: false,
  },
  999: {
    id: 999,
    name: "HyperEVM",
    shortName: "HYPER",
    defiCliKey: "hyperevm",
    rpcDefault: "https://rpc.hyperliquid.xyz/evm",
    rpcEnvVar: "NEXT_PUBLIC_HYPEREVM_RPC_URL",
    nativeSymbol: "HYPE",
    isMajor: true,
    isMainnet: true,
    explorerTxUrl: (h) => `https://hyperliquid.cloud.blockscout.com/tx/${h}`,
    explorerAddressUrl: (a) => `https://hyperliquid.cloud.blockscout.com/address/${a}`,
    privateRpcRequired: false,
  },
  5000: {
    id: 5000,
    name: "Mantle",
    shortName: "MNT",
    defiCliKey: "mantle",
    rpcDefault: "https://rpc.mantle.xyz",
    rpcEnvVar: "NEXT_PUBLIC_MANTLE_RPC_URL",
    nativeSymbol: "MNT",
    isMajor: true,
    isMainnet: true,
    explorerTxUrl: (h) => `https://explorer.mantle.xyz/tx/${h}`,
    explorerAddressUrl: (a) => `https://explorer.mantle.xyz/address/${a}`,
    privateRpcRequired: false,
  },
  8453: {
    id: 8453,
    name: "Base",
    shortName: "BASE",
    defiCliKey: "base",
    rpcDefault: "https://base.drpc.org",
    rpcEnvVar: "NEXT_PUBLIC_BASE_RPC_URL",
    nativeSymbol: "ETH",
    isMajor: true,
    isMainnet: true,
    explorerTxUrl: (h) => `https://basescan.org/tx/${h}`,
    explorerAddressUrl: (a) => `https://basescan.org/address/${a}`,
    privateRpcRequired: false,
  },
  84532: {
    id: 84532,
    name: "Base Sepolia",
    shortName: "BASE-SEPOLIA",
    defiCliKey: "base-sepolia",
    rpcDefault: "https://sepolia.base.org",
    rpcEnvVar: "NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL",
    nativeSymbol: "ETH",
    isMajor: true,
    isMainnet: false,
    explorerTxUrl: (h) => `https://sepolia.basescan.org/tx/${h}`,
    explorerAddressUrl: (a) => `https://sepolia.basescan.org/address/${a}`,
    privateRpcRequired: false,
  },
};

// defi-cli's actual five mainnet chains, in canonical order
export const DEFI_CLI_CHAIN_IDS = [999, 5000, 8453, 56, 143] as const;
export type DefiCliChainId = (typeof DEFI_CLI_CHAIN_IDS)[number];

export const DEFAULT_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ?? "8453",
);

export const MAJOR_CHAIN_IDS = new Set<number>([1, 56, 143, 999, 5000, 8453]);

// §8.1 tier.bridge.allowed (Balanced) — "must be a major-chain pair
// (Base, BNB, HyperEVM, Mantle)". Excludes Ethereum mainnet (gas) and Monad
// (immature L1) by design.
export const BRIDGE_MAJOR_CHAIN_IDS = new Set<number>([56, 999, 5000, 8453]);

export function isBridgeMajorChain(id: number): boolean {
  return BRIDGE_MAJOR_CHAIN_IDS.has(id);
}

export function chainName(id: number): string {
  return CHAINS[id]?.name ?? `Chain ${id}`;
}

export function chainSpec(id: number): ChainSpec | undefined {
  return CHAINS[id];
}

export function defiCliKey(id: number): string | undefined {
  return CHAINS[id]?.defiCliKey;
}

export function isMajorChain(id: number): boolean {
  return MAJOR_CHAIN_IDS.has(id);
}

export function isDefiCliChain(id: number): id is DefiCliChainId {
  return (DEFI_CLI_CHAIN_IDS as readonly number[]).includes(id);
}

export function rpcFor(id: number): string {
  const spec = CHAINS[id];
  if (!spec) return "";
  return process.env[spec.rpcEnvVar] ?? spec.rpcDefault;
}

export const STABLECOINS = new Set([
  "USDC",
  "USDT",
  "DAI",
  "USDC.E",
  "USDBC",
  "FRAX",
  "LUSD",
  "PYUSD",
  "USDS",
  "MUSD",
  "USDE",
]);

export const MAJOR_ASSETS = new Set([
  "ETH",
  "WETH",
  "BTC",
  "WBTC",
  "CBBTC",
  "CBETH",
  "HYPE",
  "MNT",
  "BNB",
  "MON",
  ...STABLECOINS,
]);

export function isStablecoin(symbol: string): boolean {
  return STABLECOINS.has(symbol.toUpperCase());
}

export function isMajorAsset(symbol: string): boolean {
  return MAJOR_ASSETS.has(symbol.toUpperCase());
}

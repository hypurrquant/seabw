export interface ChainSpec {
  id: number;
  name: string;
  shortName: string;
  rpcDefault: string;
  rpcEnvVar: string;
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
    rpcDefault: "https://bsc-dataseed1.binance.org",
    rpcEnvVar: "NEXT_PUBLIC_BNB_RPC_URL",
    nativeSymbol: "BNB",
    isMajor: true,
    isMainnet: true,
    explorerTxUrl: (h) => `https://bscscan.com/tx/${h}`,
    explorerAddressUrl: (a) => `https://bscscan.com/address/${a}`,
    privateRpcRequired: false,
  },
  999: {
    id: 999,
    name: "HyperEVM",
    shortName: "HYPER",
    rpcDefault: "https://rpc.hyperliquid.xyz/evm",
    rpcEnvVar: "NEXT_PUBLIC_HYPEREVM_RPC_URL",
    nativeSymbol: "HYPE",
    isMajor: true,
    isMainnet: true,
    explorerTxUrl: (h) => `https://hyperliquid.cloud.blockscout.com/tx/${h}`,
    explorerAddressUrl: (a) => `https://hyperliquid.cloud.blockscout.com/address/${a}`,
    privateRpcRequired: false,
  },
  8453: {
    id: 8453,
    name: "Base",
    shortName: "BASE",
    rpcDefault: "https://base.drpc.org",
    rpcEnvVar: "NEXT_PUBLIC_BASE_RPC_URL",
    nativeSymbol: "ETH",
    isMajor: true,
    isMainnet: true,
    explorerTxUrl: (h) => `https://basescan.org/tx/${h}`,
    explorerAddressUrl: (a) => `https://basescan.org/address/${a}`,
    privateRpcRequired: false,
  },
};

export const DEFAULT_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ?? "999",
);

export function chainName(id: number): string {
  return CHAINS[id]?.name ?? `Chain ${id}`;
}

export function chainSpec(id: number): ChainSpec | undefined {
  return CHAINS[id];
}

export function rpcFor(id: number): string {
  const spec = CHAINS[id];
  if (!spec) return "";
  return process.env[spec.rpcEnvVar] ?? spec.rpcDefault;
}

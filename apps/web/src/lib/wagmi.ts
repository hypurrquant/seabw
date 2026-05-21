import { defineChain, type Chain } from "viem";
import { createConfig, http } from "wagmi";
import { injected, mock, walletConnect } from "wagmi/connectors";
import type { Config } from "wagmi";
import { CHAINS, rpcFor } from "@/lib/chains";

export const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const hyperEvm = defineChain({
  id: 999,
  name: "HyperEVM",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: {
    default: { http: [CHAINS[999]!.rpcDefault] },
  },
  blockExplorers: {
    default: {
      name: "Hyperliquid Explorer",
      url: "https://hyperliquid.cloud.blockscout.com",
    },
  },
});

// v1.3.1: HyperEVM (999) 단일. v1.2.2 prod gate 와 정합.
export const SUPPORTED_CHAINS = [
  hyperEvm,
] as const satisfies readonly [Chain, ...Chain[]];

let cached: Config | null = null;

export function getWagmiConfig(): Config {
  if (cached) return cached;
  const metadata = {
    name: "DefiPilot",
    description: "Tell us your DeFi goal. We'll build the plan.",
    url:
      typeof window === "undefined"
        ? "https://defipilot.app"
        : window.location.origin,
    icons: ["https://defipilot.app/favicon.ico"],
  };

  const onClient = typeof window !== "undefined";
  const e2eMode = process.env.NEXT_PUBLIC_E2E === "1";
  const E2E_ACCOUNT = "0x0000000000000000000000000000000000000abc" as `0x${string}`;
  cached = createConfig({
    chains: SUPPORTED_CHAINS,
    ssr: true,
    multiInjectedProviderDiscovery: !e2eMode,
    transports: {
      [hyperEvm.id]: http(rpcFor(hyperEvm.id)),
    },
    connectors: e2eMode
      ? [mock({ accounts: [E2E_ACCOUNT], features: { reconnect: true } })]
      : [
          injected({ shimDisconnect: true }),
          ...(onClient && projectId
            ? [walletConnect({ projectId, metadata, showQrModal: true })]
            : []),
        ],
  });
  return cached;
}

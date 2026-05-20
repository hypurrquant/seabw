import { createPublicClient, http } from "viem";
import { getAccount } from "wagmi/actions";
import { getWagmiConfig, SUPPORTED_CHAINS } from "@/lib/wagmi";
import type { RegistryDeps } from "../tools";

const SUPPORTED_CHAIN_MAP = Object.fromEntries(
  SUPPORTED_CHAINS.map((chain) => [chain.id, chain]),
);

function createEphemeralBalanceStore(): RegistryDeps["balanceStore"] {
  const cache: Record<string, Record<string, Record<string, bigint>>> = {};
  return {
    getState: () => ({
      cache,
      refresh: async () => undefined,
      getBalance: () => 0n,
    }),
  };
}

export function buildRegistryDeps(getAuthToken: () => string): RegistryDeps {
  const clients = new Map<number, ReturnType<RegistryDeps["getPublicClient"]>>();

  return {
    getPublicClient(chainId) {
      if (!clients.has(chainId)) {
        const chain = SUPPORTED_CHAIN_MAP[chainId];
        if (!chain) throw new Error(`chain ${chainId} not in SUPPORTED_CHAINS`);
        clients.set(
          chainId,
          createPublicClient({ chain, transport: http() }) as ReturnType<RegistryDeps["getPublicClient"]>,
        );
      }
      return clients.get(chainId)!;
    },
    getActiveAccount() {
      const account = getAccount(getWagmiConfig());
      return {
        activeAddress: account.address ?? null,
        executionMode: "eoa",
        ready: account.status === "connected",
      };
    },
    balanceStore: createEphemeralBalanceStore(),
    getRelaySignDeps: () => null,
    getAuthToken,
  };
}

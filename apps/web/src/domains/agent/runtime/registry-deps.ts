import { createPublicClient, http } from "viem";
import { getAccount } from "wagmi/actions";
import { useTokenBalanceStore } from "@hq/react/balance";
import { refreshTokenBalances } from "@hq/react/balance";
import { getWagmiConfig, SUPPORTED_CHAINS } from "@/lib/wagmi";
import type { RegistryDeps } from "../tools";

const SUPPORTED_CHAIN_MAP = Object.fromEntries(
  SUPPORTED_CHAINS.map((chain) => [chain.id, chain]),
);

// Bridge HQ's real `useTokenBalanceStore` into RegistryDeps shape. Without
// this, AI tool handlers (get_enriched_balances etc.) read from an empty
// ephemeral stub even though prefetch/refreshAll has populated the real store.
function createHqBalanceStore(): RegistryDeps["balanceStore"] {
  return {
    getState: () => {
      const s = useTokenBalanceStore.getState();
      return {
        cache: s.cache,
        refresh: (owner, chainId, tokens) =>
          refreshTokenBalances(owner, chainId, tokens),
        getBalance: (owner, chainId, token) => s.getBalance(owner, chainId, token),
      };
    },
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
    balanceStore: createHqBalanceStore(),
    getRelaySignDeps: () => null,
    getAuthToken,
  };
}

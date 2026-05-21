"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ensurePools, usePoolStore } from "@hq/react/defi/lp/pool";
import { fetchPositionsByChain } from "@hq/react/defi/lp/position";
import { refreshAll } from "@hq/react/store/refreshAll";
import { SUPPORTED_CHAINS } from "@/lib/wagmi";

export type PrefetchStatus = "idle" | "loading" | "ready" | "error";

export interface PrefetchState {
  status: PrefetchStatus;
  error?: string;
  retry: () => void;
}

export function usePrefetchUserData(
  owner: `0x${string}` | undefined,
): PrefetchState {
  const [status, setStatus] = useState<PrefetchStatus>("idle");
  const [error, setError] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const runningRef = useRef(false);

  const run = useCallback(async (ownerAddress: `0x${string}`) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus("loading");
    setError(undefined);
    console.info("[prefetch] start", { owner: ownerAddress });

    try {
      console.info("[prefetch] ensurePools");
      await ensurePools();

      // Restrict to SUPPORTED_CHAINS (HyperEVM 999 only). Empty array means
      // "all chains" — would hit Enso for 8 chains and get rate-limited (429).
      const chainIds = SUPPORTED_CHAINS.map((c) => c.id);
      console.info("[prefetch] refreshAll balances", { chainIds });
      await refreshAll(ownerAddress, chainIds);

      const allPools = usePoolStore.getState().pools;
      for (const chain of SUPPORTED_CHAINS) {
        const chainPools = allPools.filter(
          (p) => p.core.scope.chainId === chain.id,
        );
        if (chainPools.length === 0) {
          console.info("[prefetch] no pools for chain", chain.id);
          continue;
        }
        console.info("[prefetch] fetchPositionsByChain", {
          chainId: chain.id,
          poolCount: chainPools.length,
        });
        await fetchPositionsByChain(ownerAddress, chain.id, chainPools);
      }

      console.info("[prefetch] done");
      setStatus("ready");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[prefetch] failure", err);
      setError(msg);
      setStatus("error");
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!owner) {
      setStatus("idle");
      return;
    }
    void run(owner);
  }, [owner, attempt, run]);

  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  return { status, error, retry };
}

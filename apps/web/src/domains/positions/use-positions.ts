"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  enrichWithPoolData,
  fetchAllPositions,
  usePositionStore,
  type EnrichedPosition,
} from "@hq/react/defi/lp/position";
import { ensurePools, usePools, usePoolStore } from "@hq/react/defi/lp/pool";
import { SUPPORTED_CHAINS } from "@hq/core/config/chains";
import type { PoolDTO } from "@hq/core/defi/lp/pool";
import { useApp } from "@/state/app-state";

export interface ChainGroup {
  chainId: number;
  displayName: string;
  totalCount: number;
}

function groupByChain(positions: EnrichedPosition[]): ChainGroup[] {
  return Object.entries(SUPPORTED_CHAINS)
    .map(([, config]) => ({
      chainId: config.chain.id,
      displayName: config.displayName,
      totalCount: positions.filter((p) => p.chainId === config.chain.id).length,
    }))
    .filter((g) => g.totalCount > 0);
}

// seabw-native variant of HQ's useMintPositionStrip — owner comes from SIWE
// auth state instead of HQ Privy AccountStore, since seabw does not wire HQ's
// account store.
export function usePositions() {
  const { state } = useApp();
  const ownerAddress =
    state.auth.status === "authed" && state.auth.ownerAddress
      ? (state.auth.ownerAddress.toLowerCase() as `0x${string}`)
      : null;

  const positionCache = usePositionStore((s) => s.cache);
  const getAllPositions = usePositionStore((s) => s.getAllPositions);
  const isFetchingFor = usePositionStore((s) => s.isFetchingFor);

  const { poolMap: sdkPoolMap, loading: poolsLoading } = usePools();

  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);

  useEffect(() => {
    if (!ownerAddress) return;
    void ensurePools().then(() => {
      void fetchAllPositions(ownerAddress, usePoolStore.getState().pools);
    });
  }, [ownerAddress]);

  const rawPositions = useMemo(() => {
    if (!ownerAddress) return [];
    return getAllPositions(ownerAddress).filter((p) => p.liquidity !== "0");
    // positionCache subscription drives re-renders when fetchAllPositions
    // mutates the store — getAllPositions itself is a stable selector ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerAddress, getAllPositions, positionCache]);

  const enrichmentPoolMap = useMemo(() => {
    const map = new Map<string, PoolDTO>();
    for (const [, pool] of sdkPoolMap) {
      const key = `${pool.core.scope.chainId}:${pool.core.address.toLowerCase()}`;
      map.set(key, pool);
    }
    return map;
  }, [sdkPoolMap]);

  const allPositions = useMemo(
    () => enrichWithPoolData(rawPositions, enrichmentPoolMap),
    [rawPositions, enrichmentPoolMap],
  );

  const chainGroups = useMemo(() => groupByChain(allPositions), [allPositions]);

  const totalCount = allPositions.length;
  const totalValueUsd = useMemo(() => {
    let sum = 0;
    let hasAny = false;
    for (const pos of allPositions) {
      if (pos.valueUsd !== null) {
        sum += pos.valueUsd;
        hasAny = true;
      }
    }
    return hasAny ? sum : null;
  }, [allPositions]);

  const filteredPositions = useMemo(() => {
    if (selectedChainId === null) return allPositions;
    return allPositions.filter((p) => p.chainId === selectedChainId);
  }, [allPositions, selectedChainId]);

  const isFetching = ownerAddress
    ? isFetchingFor(ownerAddress, null, null)
    : false;
  const hasNeverFetched =
    ownerAddress !== null &&
    !poolsLoading &&
    !isFetching &&
    rawPositions.length === 0 &&
    positionCache[ownerAddress] === undefined;
  const isLoading = poolsLoading || isFetching || hasNeverFetched;

  const refresh = useCallback(() => {
    if (!ownerAddress) return;
    void ensurePools().then(() => {
      void fetchAllPositions(ownerAddress, usePoolStore.getState().pools);
    });
  }, [ownerAddress]);

  return {
    ownerAddress,
    allPositions,
    filteredPositions,
    chainGroups,
    totalCount,
    totalValueUsd,
    selectedChainId,
    setSelectedChainId,
    isLoading,
    refresh,
  };
}

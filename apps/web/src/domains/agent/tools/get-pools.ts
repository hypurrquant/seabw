/**
 * get_pools tool handler (v1.58.17).
 *
 * usePoolStore (Zustand) + queryPools() SSOT로 pool 검색.
 * 서버 API 호출 없이 클라이언트 store에서 in-memory 필터링.
 */

import type { ToolResult } from '@hq/react/agent';
import { ensurePools, usePoolStore } from '@hq/react/defi/lp/pool';
import { queryPools, EMPTY_RANGE } from '@hq/core/defi/lp/pool';
import type { PoolQuery } from '@hq/core/defi/lp/pool';
import type { PoolDTO } from '@hq/core/defi/lp/pool';
import { getPoolTvl, toPoolIdFromDTO } from '@hq/core/defi/lp/pool';

type SortBy = 'tvl' | 'apr' | 'volume';

function sortPools(pools: PoolDTO[], sortBy: SortBy): PoolDTO[] {
  return [...pools].sort((a, b) => {
    switch (sortBy) {
      case 'apr':
        return (b.apr.total ?? 0) - (a.apr.total ?? 0);
      case 'tvl':
      default:
        return getPoolTvl(b) - getPoolTvl(a);
    }
  });
}

function summarizePool(pool: PoolDTO) {
  return {
    poolId: toPoolIdFromDTO(pool),
    chainId: pool.core.scope.chainId,
    dex: pool.core.scope.dex,
    token0: { symbol: pool.core.token0.symbol, address: pool.core.token0.address },
    token1: { symbol: pool.core.token1.symbol, address: pool.core.token1.address },
    fee: pool.core.fee,
    apr: pool.apr.total,
    tvlEstimate: Math.round(getPoolTvl(pool)),
    hasEmission: pool.emission !== null,
  };
}

export async function getPoolsHandler(args: Record<string, unknown>): Promise<ToolResult> {
  // 1. Store에서 pool 데이터 확보 (cold-start 대응)
  try {
    await ensurePools();
  } catch { // @ci-exception(no-empty-catch) /* error propagated via return { status: 'error' } */
    return { status: 'error', code: 'FETCH_ERROR', message: 'Failed to fetch pools' };
  }

  const { pools } = usePoolStore.getState();

  // 2. PoolQuery 조립
  const query: PoolQuery = {
    search: typeof args['search'] === 'string' ? args['search'] : null,
    token: typeof args['token'] === 'string' ? args['token'] : null,
    chains: args['chainId'] ? [Number(args['chainId'])] : [],
    dexes: args['dex'] ? [String(args['dex'])] : [],
    tvl: { min: args['minTvl'] ? Number(args['minTvl']) : null, max: null },
    apr: { min: args['minApr'] ? Number(args['minApr']) : null, max: null },
    poolFee: EMPTY_RANGE,
    weeklyRewards: EMPTY_RANGE,
    favoritesOnly: false,
    favoriteIds: new Set(),
  };

  // 3. 필터링 (SSOT)
  const filtered = queryPools(pools, query);

  // 4. 정렬 + limit
  const rawSortBy = args['sortBy'];
  const sortBy: SortBy = (rawSortBy === 'apr' || rawSortBy === 'tvl' || rawSortBy === 'volume') ? rawSortBy : 'tvl';
  const sorted = sortPools(filtered, sortBy);
  const limit = Math.min(Number(args['limit'] ?? 10), 50);
  const limited = sorted.slice(0, limit);

  // 5. Compact summary + 토큰 정보
  return {
    status: 'success',
    data: {
      total: filtered.length,
      returned: limited.length,
      sortBy,
      pools: limited.map(summarizePool),
    },
  };
}

/**
 * get_positions tool handler — v1.57.1
 *
 * FE direct LP position fetch.
 */

import type { ToolResult } from '@hq/react/agent';
import type { RegistryDeps } from './index';
import { ensurePools, usePoolConfigStore, usePoolStore } from '@hq/react/defi/lp/pool';
import type { UniversalPosition } from '@hq/core/defi/lp/position';
import { isAddress } from 'viem';
import { createLogger } from '@hq/core/logging';

const logger = createLogger('agent:get-positions');
import { fetchPositionsByChain, usePositionStore } from '@hq/react/defi/lp/position';

function serializePosition(pos: UniversalPosition): Record<string, unknown> {
  return {
    tokenId: pos.tokenId,
    dexId: pos.dexId,
    chainId: pos.chainId,
    poolAddress: pos.poolAddress,
    token0: {
      address: pos.token0.address,
      symbol: pos.token0.symbol,
      decimals: pos.token0.decimals,
      amount: String(pos.token0.amount),
    },
    token1: {
      address: pos.token1.address,
      symbol: pos.token1.symbol,
      decimals: pos.token1.decimals,
      amount: String(pos.token1.amount),
    },
    tickLower: pos.tickLower,
    tickUpper: pos.tickUpper,
    liquidity: pos.liquidity,
    currentTick: pos.currentTick,
    inRange: pos.inRange,
    stakeState: pos.stakeState,
    poolName: pos.poolName,
    dexDisplayName: pos.dexDisplayName,
  };
}

export function createGetPositionsHandler(deps: RegistryDeps) {
  return async function getPositionsHandler(args: Record<string, unknown>): Promise<ToolResult> {
    void deps;

    const owner = args['owner'];
    if (!owner) {
      return { status: 'error', code: 'MISSING_PARAM', message: 'owner is required' };
    }

    const ownerStr = String(owner).toLowerCase();
    if (!isAddress(ownerStr)) {
      return { status: 'error', code: 'INVALID_PARAM', message: `owner is not a valid address: ${ownerStr}` };
    }
    const ownerAddress = ownerStr;

    // chainIds: 배열로 받음. 없으면 전체 지원 체인 조회
    const chainIds = args['chainIds'];
    const lpChains = usePoolConfigStore.getState().getSupportedChainIds();
    if (lpChains.length === 0) {
      return { status: 'success', data: { data: [], count: 0 } };
    }
    const chains: number[] = Array.isArray(chainIds) && chainIds.length > 0
      ? chainIds.map(Number)
      : lpChains;

    const allPositions: Record<string, unknown>[] = [];

    try {
      await ensurePools();
      const pools = usePoolStore.getState().pools;
      await Promise.all(
        chains.map(async (cid) => {
          await fetchPositionsByChain(ownerAddress, cid, pools);
        }),
      );
    } catch (err) { // @ci-exception(no-empty-catch) — agent tool은 에러를 ToolResult로 반환 (사용자 관측 가능)
      logger.warn('Failed to fetch positions', { err });
      return { status: 'error', code: 'FETCH_ERROR', message: 'Failed to fetch positions' };
    }

    const positions = usePositionStore.getState().getAllPositions(ownerAddress);
    const active = positions.filter((p) => BigInt(p.liquidity) > 0n);
    allPositions.push(...active.map(serializePosition));

    return { status: 'success', data: { data: allPositions, count: allPositions.length } };
  };
}

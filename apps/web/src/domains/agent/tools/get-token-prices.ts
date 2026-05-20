/**
 * get_token_prices tool handler (v1.58.19).
 *
 * useTokenPriceStore (Zustand)에서 가격 데이터 조회.
 * 서버 API 호출 없이 클라이언트 store에서 in-memory lookup.
 */

import type { ToolResult } from '@hq/react/agent';
import { useTokenPriceStore } from '@hq/react/price/store/useTokenPriceStore';
import { refreshTokenPrices } from '@hq/react/price/commands/refreshTokenPrices';
import { useTokenConfigStore } from '@hq/react/token';

export async function getTokenPricesHandler(args: Record<string, unknown>): Promise<ToolResult> {
  const chainId = args['chainId'];
  if (!chainId) {
    return { status: 'error', code: 'MISSING_PARAM', message: 'chainId is required' };
  }

  const chainKey = String(chainId);

  // cold-start 대응: cache 비어있으면 refresh
  const state = useTokenPriceStore.getState();
  if (Object.keys(state.cache).length === 0) {
    try {
      await refreshTokenPrices(useTokenConfigStore.getState().tokens);
    } catch { // @ci-exception(no-empty-catch) /* error propagated via return { status: 'error' } */
      return { status: 'error', code: 'FETCH_ERROR', message: 'Failed to fetch token prices' };
    }
  }

  const chainSlice = useTokenPriceStore.getState().cache[chainKey];
  if (!chainSlice) {
    return { status: 'success', data: [] };
  }

  // { address → priceUsd } 맵을 배열로 변환
  let entries = Object.entries(chainSlice).map(([address, priceUsd]) => ({
    address,
    priceUsd,
  }));

  // addresses 필터
  const addresses = args['addresses'];
  if (Array.isArray(addresses) && addresses.length > 0) {
    const addrSet = new Set(addresses.map((a) => String(a).toLowerCase()));
    entries = entries.filter((e) => addrSet.has(e.address));
  }

  return { status: 'success', data: entries };
}

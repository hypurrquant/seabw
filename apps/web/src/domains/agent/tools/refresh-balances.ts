/**
 * refresh_balances — refreshAll 기반 전체 토큰 갱신 (v1.57.3)
 *
 * v1.57.3: tokens[] 파라미터 제거 → refreshAll(owner, chainIds) 호출.
 * owner는 active wallet에서 resolve. chainId는 optional (없으면 전체 체인).
 */
import { refreshAll } from '@hq/react/store/refreshAll';
import { resolveActiveAddress } from './resolve-defaults';
import type { ToolResult } from '@hq/react/agent';
import type { BrowserToolHandler } from './BrowserToolRegistry';
import type { RegistryDeps } from './index';

export function createRefreshBalancesHandler(deps: RegistryDeps): BrowserToolHandler {
  return async (args: Record<string, unknown>): Promise<ToolResult> => {
    const address = resolveActiveAddress(deps.getActiveAccount);
    if (typeof address !== 'string') return address;

    const chainId = typeof args['chainId'] === 'number' ? args['chainId'] : null;
    const chainIds = chainId !== null ? [chainId] : [];

    await refreshAll(address, chainIds);

    return {
      status: 'success',
      data: {
        message: chainId
          ? `Balances refreshed for chain ${chainId}`
          : 'Balances refreshed for all chains',
      },
    };
  };
}

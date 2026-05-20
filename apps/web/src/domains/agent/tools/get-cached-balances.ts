/**
 * get_cached_balances — Zustand store에서 캐시된 잔액 읽기 (v1.56.8)
 */
import type { ToolResult } from '@hq/react/agent';
import type { BrowserToolHandler } from './BrowserToolRegistry';
import type { RegistryDeps } from './index';
import { num, str, isErr } from './helpers';

export function createGetCachedBalancesHandler(deps: RegistryDeps): BrowserToolHandler {
  return async (args: Record<string, unknown>): Promise<ToolResult> => {
    const chainId = num(args, 'chainId');
    if (isErr(chainId)) return { status: 'error', code: 'MISSING_PARAM', message: chainId.error };
    const owner = str(args, 'owner');
    if (isErr(owner)) return { status: 'error', code: 'MISSING_PARAM', message: owner.error };

    const cache = deps.balanceStore.getState().cache;
    const ownerCache = cache[owner.toLowerCase()];
    const chainCache = ownerCache?.[String(chainId)] ?? {};

    // bigint → string 변환 (JSON 직렬화)
    const balances: Record<string, string> = {};
    for (const [token, balance] of Object.entries(chainCache)) {
      balances[token] = balance.toString();
    }

    return { status: 'success', data: balances };
  };
}

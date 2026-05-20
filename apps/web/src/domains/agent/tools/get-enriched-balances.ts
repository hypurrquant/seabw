/**
 * get_enriched_balances — refreshAll 기반 + balance > 0 필터 + price 합산 (v1.57.3)
 *
 * v1.57.3: 직접 config store 조회 제거 → refreshAll 호출로 통합.
 * enrichment (price, formatting, filtering)는 이 handler의 책임.
 */
import { formatUnits } from 'viem';
import { useTokenConfigStore } from '@hq/react/token';
import { useTokenPriceStore } from '@hq/react/price/store/useTokenPriceStore';
import { getBalanceSlice } from '@hq/react/balance';
import { refreshAll } from '@hq/react/store/refreshAll';
import type { ToolResult } from '@hq/react/agent';
import type { BrowserToolHandler } from './BrowserToolRegistry';
import type { RegistryDeps } from './index';

export function createGetEnrichedBalancesHandler(deps: RegistryDeps): BrowserToolHandler {
  return async (args: Record<string, unknown>): Promise<ToolResult> => {
    const account = deps.getActiveAccount();
    if (!account.activeAddress) {
      return { status: 'error', code: 'NO_WALLET', message: 'Wallet not connected' };
    }

    const chainId = typeof args['chainId'] === 'number' ? args['chainId'] : null;
    const owner = account.activeAddress;

    // refreshAll로 토큰 resolve + refresh 통합
    const chainIds = chainId ? [chainId] : [];
    await refreshAll(owner, chainIds);

    // 체인별 토큰 목록 (enrichment용)
    const configTokens = useTokenConfigStore.getState().tokens;
    const tokensByChain = new Map<number, Array<{ address: `0x${string}`; symbol: string; decimals: number }>>();
    for (const token of configTokens) {
      if (chainId && token.chainId !== chainId) continue;
      const list = tokensByChain.get(token.chainId) ?? [];
      list.push({ address: token.address, symbol: token.symbol, decimals: token.decimals });
      tokensByChain.set(token.chainId, list);
    }

    // balance > 0 필터 + price 합산
    const updatedCache = deps.balanceStore.getState().cache;
    const results: Array<{
      chainId: number;
      address: string;
      symbol: string;
      balance: string;
      balanceFormatted: string;
      priceUsd: number | null;
      valueUsd: number | null;
    }> = [];

    for (const [cid, tokens] of tokensByChain) {
      const balSlice = getBalanceSlice(updatedCache, owner, cid);
      for (const token of tokens) {
        const balance = balSlice[token.address.toLowerCase()] ?? 0n;
        if (balance === 0n) continue;

        const balanceFormatted = formatUnits(balance, token.decimals);
        const balanceNum = Number(balanceFormatted);

        let priceUsd: number | null = null;
        let valueUsd: number | null = null;
        try {
          const priceCache = useTokenPriceStore.getState().cache;
          const chainPrices = priceCache[String(cid)];
          if (chainPrices) {
            priceUsd = chainPrices[token.address.toLowerCase()] ?? null;
            if (priceUsd !== null) valueUsd = balanceNum * priceUsd;
          }
        } catch { // @ci-exception(no-empty-catch) /* token price optional enrichment 실패 — null 유지 */
          // price 없으면 null
        }

        results.push({
          chainId: cid,
          address: token.address,
          symbol: token.symbol,
          balance: balance.toString(),
          balanceFormatted,
          priceUsd,
          valueUsd,
        });
      }
    }

    results.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));

    return {
      status: 'success',
      data: {
        owner,
        chainId: chainId ?? 'all',
        tokenCount: results.length,
        tokens: results,
      },
    };
  };
}

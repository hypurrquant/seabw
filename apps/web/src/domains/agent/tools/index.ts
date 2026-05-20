/**
 * Browser Tool Registry 초기화 (v1.58.21).
 *
 * Handler만 등록. Schema는 MCP server (apps/server/tools/)에서 관리.
 * v1.58.21: prepare_*_tx 6개 제거 — compose_pipeline으로 통일.
 * v1.57.1: legacy server query 제거 — prepare-* tools는 buildStepOnServer 경유, swap/position은 FE direct.
 */

import { BrowserToolRegistry } from './BrowserToolRegistry';
import { getPoolsHandler } from './get-pools';
import { getPoolDetailHandler } from './get-pool-detail';
import { getTickDataHandler } from './get-tick-data';
import { getTokenPricesHandler } from './get-token-prices';
import { createGetPositionsHandler } from './get-positions';
import { createGetSwapQuoteHandler } from './get-swap-quote';
import { createGetTokenBalancesHandler } from './get-token-balances';
import { createGetCachedBalancesHandler } from './get-cached-balances';
import { createRefreshBalancesHandler } from './refresh-balances';
import { createGetWalletStatusHandler } from './get-wallet-status';
import { createComposePipelineHandler } from './compose-pipeline/handler';
import { createCalculateTokenRatioHandler } from './calculate-token-ratio';
import { createCalculateDepositAmountsHandler } from './calculate-deposit-amounts';
import { createCalculateOptimalRangeHandler } from './calculate-optimal-range';
import { createCalculateSwapPlanHandler } from './calculate-swap-plan';
import { createCalculateTickRangeHandler } from './calculate-tick-range';
import { createCalculateRangeForRatioHandler } from './calculate-range-for-ratio';
import { createGetEnrichedBalancesHandler } from './get-enriched-balances';
import { createGetNativeBalanceHandler } from './get-native-balance';
import { createGetTokensHandler, createGetTokenDetailHandler } from './get-tokens';

// ── DI 타입 ──

import type { PublicClient } from 'viem';
import type { RelaySignDeps } from '@hq/core/defi/routing';

export type RegistryDeps = {
  getPublicClient: (chainId: number) => PublicClient;
  getActiveAccount: () => { activeAddress: `0x${string}` | null; executionMode: string; ready: boolean };
  balanceStore: { getState: () => { cache: Record<string, Record<string, Record<string, bigint>>>; refresh: (owner: `0x${string}`, chainId: number, tokens: `0x${string}`[]) => Promise<void>; getBalance: (owner: `0x${string}`, chainId: number, token: `0x${string}`) => bigint } };
  getRelaySignDeps: () => RelaySignDeps | null; // cross-chain swap용. 지갑 미연결 시 null
  getAuthToken: () => string; // v1.57.1: pipeline server API 인증 토큰
};

export function createBrowserToolRegistry(deps: RegistryDeps): BrowserToolRegistry {
  const registry = new BrowserToolRegistry();

  // ─── Query Tools ─────────────────────────────────────────

  registry.register('get_tokens', createGetTokensHandler());
  registry.register('get_token_detail', createGetTokenDetailHandler());
  registry.register('get_pools', getPoolsHandler);
  registry.register('get_pool_detail', getPoolDetailHandler);
  registry.register('get_tick_data', getTickDataHandler);
  registry.register('get_token_prices', getTokenPricesHandler);
  registry.register('get_positions', createGetPositionsHandler(deps));
  registry.register('get_swap_quote', createGetSwapQuoteHandler(deps));

  // ─── Balance / Status Tools ──────────────────────────────

  registry.register('get_token_balances', createGetTokenBalancesHandler(deps));
  registry.register('get_cached_balances', createGetCachedBalancesHandler(deps));
  registry.register('refresh_balances', createRefreshBalancesHandler(deps));
  registry.register('get_wallet_status', createGetWalletStatusHandler(deps));
  registry.register('get_enriched_balances', createGetEnrichedBalancesHandler(deps));
  registry.register('get_native_balance', createGetNativeBalanceHandler(deps));

  // ─── Pipeline Composition ───────────────────────────────
  // v1.58.21: compose_pipeline이 유일한 TX 실행 경로. 단건도 stage 1개 파이프라인으로.

  registry.register('compose_pipeline', createComposePipelineHandler(deps));

  // ─── Calculation Tools ──────────────────────────────────

  registry.register('calculate_token_ratio', createCalculateTokenRatioHandler(deps));
  registry.register('calculate_deposit_amounts', createCalculateDepositAmountsHandler(deps));
  registry.register('calculate_optimal_range', createCalculateOptimalRangeHandler(deps));
  registry.register('calculate_swap_plan', createCalculateSwapPlanHandler(deps));
  registry.register('calculate_tick_range', createCalculateTickRangeHandler(deps));
  registry.register('calculate_range_for_ratio', createCalculateRangeForRatioHandler(deps));

  return registry;
}


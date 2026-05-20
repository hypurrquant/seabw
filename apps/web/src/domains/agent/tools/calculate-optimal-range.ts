/**
 * calculate_optimal_range tool (v1.57.1)
 *
 * v1.57.1: 서버 /pipeline/calculate API 호출로 전환.
 * get_tick_data가 반환한 derived TickLiquidityRange[]를 받아
 * 유동성 밀집 구간 후보를 ranking하여 반환한다.
 * price -> tick 변환 포함 (mint tool 연결 가능한 tick range 반환).
 */
import { num, optNum, isErr, numResult } from './helpers';
import type { BrowserToolHandler } from './BrowserToolRegistry';
import type { RegistryDeps } from './index';
import { calculateOnServer } from '@hq/core/defi/pipeline/client';
import { ValidationError } from '@hq/core/lib/error';

type TickRangeInput = {
  priceLower: number;
  priceUpper: number;
  liquidityRaw: string;
};

type RankedRange = {
  tickLower: number;
  tickUpper: number;
  liquidityShare: number;
};

export function createCalculateOptimalRangeHandler(deps: RegistryDeps): BrowserToolHandler {
  return async (args) => {
    const tickRanges = args['tickRanges'];
    if (!Array.isArray(tickRanges)) return { status: 'success', data: [] };
    if (tickRanges.length === 0) return { status: 'success', data: [] };

    const topN = optNum(args, 'topN', 3);
    const tickSpacing = num(args, 'tickSpacing'); if (isErr(tickSpacing)) return { status: 'error', code: 'INVALID_PARAMS', message: tickSpacing.error };
    const decimals0 = num(args, 'decimals0'); if (isErr(decimals0)) return { status: 'error', code: 'INVALID_PARAMS', message: decimals0.error };
    const decimals1 = num(args, 'decimals1'); if (isErr(decimals1)) return { status: 'error', code: 'INVALID_PARAMS', message: decimals1.error };
    const windowSizeBars = optNum(args, 'windowSizeBars', 10);

    if (tickSpacing <= 0) return { status: 'error', code: 'INVALID_PARAMS', message: 'tickSpacing must be positive' };
    if (windowSizeBars <= 0) return { status: 'error', code: 'INVALID_PARAMS', message: 'windowSizeBars must be positive' };
    if (topN <= 0) return { status: 'error', code: 'INVALID_PARAMS', message: 'topN must be positive' };

    try {
      const authToken = deps.getAuthToken();
      // validate that each element of tickRanges is a TickRangeInput
      function isTickRangeInput(r: unknown): r is TickRangeInput {
        if (typeof r !== 'object' || r === null) return false;
        const rec: Record<string, unknown> = Object.fromEntries(Object.entries(r));
        return typeof rec['priceLower'] === 'number' && typeof rec['priceUpper'] === 'number' && typeof rec['liquidityRaw'] === 'string';
      }
      const ranges: TickRangeInput[] = tickRanges.filter(isTickRangeInput);

      // price -> tick 변환 + tickSpacing align (병렬 호출)
      const barPromises = ranges.map(async (r) => {
        const [rawTickLow, rawTickUp] = await Promise.all([
          calculateOnServer('priceToTick', { price: r.priceLower, decimals0, decimals1 }, authToken),
          calculateOnServer('priceToTick', { price: r.priceUpper, decimals0, decimals1 }, authToken),
        ]);

        const rawLow = numResult(rawTickLow, 'priceToTick lower');
        if (isErr(rawLow)) throw new ValidationError(rawLow.error);
        const rawUp = numResult(rawTickUp, 'priceToTick upper');
        if (isErr(rawUp)) throw new ValidationError(rawUp.error);

        const [alignedLow, alignedUp] = await Promise.all([
          calculateOnServer('alignTickToSpacing', { tick: rawLow, tickSpacing, roundDown: true }, authToken),
          calculateOnServer('alignTickToSpacing', { tick: rawUp, tickSpacing, roundDown: false }, authToken),
        ]);

        const tickLow = numResult(alignedLow, 'alignTickToSpacing lower');
        if (isErr(tickLow)) throw new ValidationError(tickLow.error);
        const tickUp = numResult(alignedUp, 'alignTickToSpacing upper');
        if (isErr(tickUp)) throw new ValidationError(tickUp.error);

        let liq: bigint;
        try { liq = BigInt(r.liquidityRaw || '0'); } catch { throw new ValidationError(`Invalid liquidityRaw: ${r.liquidityRaw}`); }

        return { tickLower: tickLow, tickUpper: tickUp, liq };
      });

      const bars = await Promise.all(barPromises);

      // 전체 liquidity 합산
      let totalLiq = 0n;
      for (const b of bars) totalLiq += b.liq;
      if (totalLiq === 0n) return { status: 'success', data: [] };

      // windowSizeBars를 bars 수에 맞게 clamp
      const effectiveWindow = Math.min(windowSizeBars, bars.length);

      // sliding window ranking
      const candidates: RankedRange[] = [];
      for (let i = 0; i <= bars.length - effectiveWindow; i++) {
        const window = bars.slice(i, i + effectiveWindow);
        let windowLiq = 0n;
        for (const b of window) windowLiq += b.liq;

        const tickLower = window[0].tickLower;
        const tickUpper = window[window.length - 1].tickUpper;
        const liquidityShare = Math.round(Number((windowLiq * 10000n) / totalLiq)) / 100; // 소수점 2자리 %

        candidates.push({ tickLower, tickUpper, liquidityShare });
      }

      // liquidityShare 내림차순 정렬 -> topN
      candidates.sort((a, b) => b.liquidityShare - a.liquidityShare);
      const result = candidates.slice(0, topN);

      return { status: 'success', data: result };
    } catch (e) { // @ci-exception(no-empty-catch) /* calculation boundary returns ToolResult error envelope */
      return { status: 'error', code: 'CALC_ERROR', message: e instanceof Error ? e.message : String(e) };
    }
  };
}

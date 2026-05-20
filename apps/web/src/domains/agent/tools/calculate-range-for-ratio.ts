/**
 * calculate_range_for_ratio tool (v1.57.1)
 *
 * v1.57.1: 서버 /pipeline/calculate API 호출로 전환.
 * 목표 token0 비율(%)을 달성하는 symmetric tick range를 역산한다.
 * currentTick 중심으로 양방향 확장하며 서버 calcCoefficients + alignTickToSpacing 반복 호출.
 *
 * targetRatioPercent: token0 human-normalized share (0~100).
 * 예: 50 = "deposit 중 token0이 50%"
 */
import { num, isErr, numResult, coeffResult } from './helpers';
import type { BrowserToolHandler } from './BrowserToolRegistry';
import type { RegistryDeps } from './index';
import { calculateOnServer } from '@hq/core/defi/pipeline/client';
import { ValidationError } from '@hq/core/lib/error';

export function createCalculateRangeForRatioHandler(deps: RegistryDeps): BrowserToolHandler {
  return async (args) => {
    const currentTick = num(args, 'currentTick'); if (isErr(currentTick)) return { status: 'error', code: 'INVALID_PARAMS', message: currentTick.error };
    const targetRatioPercent = num(args, 'targetRatioPercent'); if (isErr(targetRatioPercent)) return { status: 'error', code: 'INVALID_PARAMS', message: targetRatioPercent.error };
    const tickSpacing = num(args, 'tickSpacing'); if (isErr(tickSpacing)) return { status: 'error', code: 'INVALID_PARAMS', message: tickSpacing.error };
    const decimals0 = num(args, 'decimals0'); if (isErr(decimals0)) return { status: 'error', code: 'INVALID_PARAMS', message: decimals0.error };
    const decimals1 = num(args, 'decimals1'); if (isErr(decimals1)) return { status: 'error', code: 'INVALID_PARAMS', message: decimals1.error };
    const maxWidthPercent = num(args, 'maxWidthPercent'); if (isErr(maxWidthPercent)) return { status: 'error', code: 'INVALID_PARAMS', message: maxWidthPercent.error };

    if (targetRatioPercent < 0 || targetRatioPercent > 100) {
      return { status: 'error', code: 'INVALID_PARAMS', message: 'targetRatioPercent must be 0~100' };
    }
    if (tickSpacing <= 0) return { status: 'error', code: 'INVALID_PARAMS', message: 'tickSpacing must be positive' };
    if (maxWidthPercent <= 0) return { status: 'error', code: 'INVALID_PARAMS', message: 'maxWidthPercent must be positive' };

    try {
      const authToken = deps.getAuthToken();

      // maxDeltaTicks = ln(1 + maxWidthPercent/100) / ln(1.0001)
      const maxDeltaTicks = Math.log(1 + maxWidthPercent / 100) / Math.log(1.0001);
      const maxSteps = Math.ceil(maxDeltaTicks / tickSpacing);

      let bestTickLower = currentTick - tickSpacing;
      let bestTickUpper = currentTick + tickSpacing;
      let bestDiff = Infinity;
      let bestRatio = 0;

      // symmetric search: currentTick 중심 양방향 확장
      for (let step = 1; step <= maxSteps; step++) {
        const delta = step * tickSpacing;

        // alignTickToSpacing 호출 (lower: round down, upper: round up)
        const [tlResult, tuResult] = await Promise.all([
          calculateOnServer('alignTickToSpacing', { tick: currentTick - delta, tickSpacing, roundDown: true }, authToken),
          calculateOnServer('alignTickToSpacing', { tick: currentTick + delta, tickSpacing, roundDown: false }, authToken),
        ]);
        const tl = numResult(tlResult, 'alignTickToSpacing lower');
        if (isErr(tl)) throw new ValidationError(tl.error);
        const tu = numResult(tuResult, 'alignTickToSpacing upper');
        if (isErr(tu)) throw new ValidationError(tu.error);

        if (tl >= tu) continue;

        const rawCoeff = await calculateOnServer('calcCoefficients', { currentTick, tickLower: tl, tickUpper: tu }, authToken);
        const coeff = coeffResult(rawCoeff);
        if (isErr(coeff)) throw new ValidationError(coeff.error);

        // human-normalized: decimals 보정
        const humanC0 = coeff.c0 / (10 ** decimals0);
        const humanC1 = coeff.c1 / (10 ** decimals1);
        const total = humanC0 + humanC1;
        const ratio = total === 0 ? 0 : (humanC0 / total) * 100;
        const diff = Math.abs(ratio - targetRatioPercent);

        if (diff < bestDiff) {
          bestDiff = diff;
          bestRatio = ratio;
          bestTickLower = tl;
          bestTickUpper = tu;
        }

        // exact match (< 0.5% tolerance)
        if (diff < 0.5) break;
      }

      const exact = bestDiff < 0.5;

      return {
        status: 'success',
        data: {
          tickLower: bestTickLower,
          tickUpper: bestTickUpper,
          achievedRatioPercent: Math.round(bestRatio * 100) / 100,
          exact,
        },
      };
    } catch (e) { // @ci-exception(no-empty-catch) /* calculation boundary returns ToolResult error envelope */
      return { status: 'error', code: 'CALC_ERROR', message: e instanceof Error ? e.message : String(e) };
    }
  };
}

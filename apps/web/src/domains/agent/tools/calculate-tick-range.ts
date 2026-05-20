/**
 * calculate_tick_range tool (v1.57.1)
 *
 * v1.57.1: 서버 /pipeline/calculate API 호출로 전환.
 * 현재 tick 기준으로 +/-percent% 범위의 tick range를 계산한다.
 */
import { num, isErr, tickRangeResult } from './helpers';
import type { BrowserToolHandler } from './BrowserToolRegistry';
import type { RegistryDeps } from './index';
import { calculateOnServer } from '@hq/core/defi/pipeline/client';

export function createCalculateTickRangeHandler(deps: RegistryDeps): BrowserToolHandler {
  return async (args) => {
    const currentTick = num(args, 'currentTick'); if (isErr(currentTick)) return { status: 'error', code: 'INVALID_PARAMS', message: currentTick.error };
    const percent = num(args, 'percent'); if (isErr(percent)) return { status: 'error', code: 'INVALID_PARAMS', message: percent.error };
    const tickSpacing = num(args, 'tickSpacing'); if (isErr(tickSpacing)) return { status: 'error', code: 'INVALID_PARAMS', message: tickSpacing.error };

    if (percent <= 0) return { status: 'error', code: 'INVALID_PARAMS', message: 'percent must be positive' };
    if (tickSpacing <= 0) return { status: 'error', code: 'INVALID_PARAMS', message: 'tickSpacing must be positive' };

    try {
      const authToken = deps.getAuthToken();
      const result = await calculateOnServer('calcTickRangeFromPercent', {
        currentTick,
        percent,
        tickSpacing,
      }, authToken);

      const range = tickRangeResult(result);
      if (isErr(range)) return { status: 'error', code: 'CALC_ERROR', message: range.error };

      return {
        status: 'success',
        data: {
          tickLower: range.tickLower,
          tickUpper: range.tickUpper,
        },
      };
    } catch (e) { // @ci-exception(no-empty-catch) /* calculation boundary returns ToolResult error envelope */
      return { status: 'error', code: 'CALC_ERROR', message: e instanceof Error ? e.message : String(e) };
    }
  };
}

/**
 * calculate_token_ratio tool (v1.57.1)
 *
 * v1.57.1: 서버 /pipeline/calculate API 호출로 전환.
 * 주어진 tick range에서 token0:token1 비율 계수를 계산한다.
 */
import { num, isErr, coeffResult } from './helpers';
import type { BrowserToolHandler } from './BrowserToolRegistry';
import type { RegistryDeps } from './index';
import { calculateOnServer } from '@hq/core/defi/pipeline/client';

export function createCalculateTokenRatioHandler(deps: RegistryDeps): BrowserToolHandler {
  return async (args) => {
    const currentTick = num(args, 'currentTick'); if (isErr(currentTick)) return { status: 'error', code: 'INVALID_PARAMS', message: currentTick.error };
    const tickLower = num(args, 'tickLower'); if (isErr(tickLower)) return { status: 'error', code: 'INVALID_PARAMS', message: tickLower.error };
    const tickUpper = num(args, 'tickUpper'); if (isErr(tickUpper)) return { status: 'error', code: 'INVALID_PARAMS', message: tickUpper.error };
    const decimals0 = num(args, 'decimals0'); if (isErr(decimals0)) return { status: 'error', code: 'INVALID_PARAMS', message: decimals0.error };
    const decimals1 = num(args, 'decimals1'); if (isErr(decimals1)) return { status: 'error', code: 'INVALID_PARAMS', message: decimals1.error };

    if (tickLower >= tickUpper) return { status: 'error', code: 'INVALID_PARAMS', message: 'tickLower must be less than tickUpper' };

    try {
      const authToken = deps.getAuthToken();
      const result = await calculateOnServer('calcCoefficients', { currentTick, tickLower, tickUpper }, authToken);
      const coeff = coeffResult(result);
      if (isErr(coeff)) return { status: 'error', code: 'CALC_ERROR', message: coeff.error };

      const humanC0 = coeff.c0 / (10 ** decimals0);
      const humanC1 = coeff.c1 / (10 ** decimals1);
      const total = humanC0 + humanC1;
      const ratioPercent = total === 0 ? 0 : (humanC0 / total) * 100;

      return {
        status: 'success',
        data: {
          c0: coeff.c0,
          c1: coeff.c1,
          case: coeff.case,
          ratioPercent: Math.round(ratioPercent * 100) / 100,
          decimals0,
          decimals1,
        },
      };
    } catch (e) { // @ci-exception(no-empty-catch) /* calculation boundary returns ToolResult error envelope */
      return { status: 'error', code: 'CALC_ERROR', message: e instanceof Error ? e.message : String(e) };
    }
  };
}

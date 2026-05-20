/**
 * calculate_swap_plan tool (v1.57.1)
 *
 * v1.57.1: 서버 /pipeline/calculate API 호출로 전환.
 * 보유 잔액과 목표 tick range 기준으로 swap 필요 여부/방향/수량을 계산한다.
 * 서버에서 calcCoefficients + calcMaxAmountsFromBalances + calcSwapDirection + calcSwapNeeded 호출.
 */
import { num, bi, isErr, coeffResult, amountsResult, swapDirectionResult, boolResult } from './helpers';
import type { BrowserToolHandler } from './BrowserToolRegistry';
import type { RegistryDeps } from './index';
import { calculateOnServer } from '@hq/core/defi/pipeline/client';

export function createCalculateSwapPlanHandler(deps: RegistryDeps): BrowserToolHandler {
  return async (args) => {
    const balance0 = bi(args, 'balance0'); if (isErr(balance0)) return { status: 'error', code: 'INVALID_PARAMS', message: balance0.error };
    const balance1 = bi(args, 'balance1'); if (isErr(balance1)) return { status: 'error', code: 'INVALID_PARAMS', message: balance1.error };
    const currentTick = num(args, 'currentTick'); if (isErr(currentTick)) return { status: 'error', code: 'INVALID_PARAMS', message: currentTick.error };
    const tickLower = num(args, 'tickLower'); if (isErr(tickLower)) return { status: 'error', code: 'INVALID_PARAMS', message: tickLower.error };
    const tickUpper = num(args, 'tickUpper'); if (isErr(tickUpper)) return { status: 'error', code: 'INVALID_PARAMS', message: tickUpper.error };

    if (tickLower >= tickUpper) return { status: 'error', code: 'INVALID_PARAMS', message: 'tickLower must be less than tickUpper' };

    try {
      const authToken = deps.getAuthToken();

      // 1. calcCoefficients
      const rawCoeff = await calculateOnServer('calcCoefficients', {
        currentTick, tickLower, tickUpper,
      }, authToken);
      const coeff = coeffResult(rawCoeff);
      if (isErr(coeff)) return { status: 'error', code: 'CALC_ERROR', message: coeff.error };

      // 2. calcMaxAmountsFromBalances
      const rawMax = await calculateOnServer('calcMaxAmountsFromBalances', {
        balance0: balance0.toString(),
        balance1: balance1.toString(),
        c0: coeff.c0,
        c1: coeff.c1,
      }, authToken);
      const maxAmounts = amountsResult(rawMax);
      if (isErr(maxAmounts)) return { status: 'error', code: 'CALC_ERROR', message: maxAmounts.error };

      // 3. calcSwapDirection
      const rawDir = await calculateOnServer('calcSwapDirection', {
        balance0: balance0.toString(),
        balance1: balance1.toString(),
        currentTick,
        c0: coeff.c0,
        c1: coeff.c1,
      }, authToken);
      const direction = swapDirectionResult(rawDir);
      if (isErr(direction)) return { status: 'error', code: 'CALC_ERROR', message: direction.error };

      // 4. calcSwapNeeded
      const rawNeeded = await calculateOnServer('calcSwapNeeded', {
        amount0: maxAmounts.amount0,
        amount1: maxAmounts.amount1,
        balance0: balance0.toString(),
        balance1: balance1.toString(),
      }, authToken);
      const swapNeeded = boolResult(rawNeeded, 'calcSwapNeeded');
      if (isErr(swapNeeded)) return { status: 'error', code: 'CALC_ERROR', message: swapNeeded.error };

      const unused0 = balance0 - BigInt(maxAmounts.amount0);
      const unused1 = balance1 - BigInt(maxAmounts.amount1);

      return {
        status: 'success',
        data: {
          swapNeeded,
          direction: swapNeeded && direction ? direction.fromToken : null,
          excessAmount: swapNeeded && direction ? direction.amountIn : '0',
          currentDeposit: {
            amount0: maxAmounts.amount0,
            amount1: maxAmounts.amount1,
          },
          unused: {
            amount0: unused0.toString(),
            amount1: unused1.toString(),
          },
        },
      };
    } catch (e) { // @ci-exception(no-empty-catch) /* calculation boundary returns ToolResult error envelope */
      return { status: 'error', code: 'CALC_ERROR', message: e instanceof Error ? e.message : String(e) };
    }
  };
}

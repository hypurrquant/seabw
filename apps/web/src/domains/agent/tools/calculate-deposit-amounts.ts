/**
 * calculate_deposit_amounts tool (v1.57.1)
 *
 * v1.57.1: 서버 /pipeline/calculate API 호출로 전환.
 * 주어진 tick range와 보유 잔액으로 최대 투입 가능한 amount를 계산한다.
 */
import { num, bi, isErr, depositSnapshotResult } from './helpers';
import type { BrowserToolHandler } from './BrowserToolRegistry';
import type { RegistryDeps } from './index';
import { calculateOnServer } from '@hq/core/defi/pipeline/client';

export function createCalculateDepositAmountsHandler(deps: RegistryDeps): BrowserToolHandler {
  return async (args) => {
    const currentTick = num(args, 'currentTick'); if (isErr(currentTick)) return { status: 'error', code: 'INVALID_PARAMS', message: currentTick.error };
    const tickLower = num(args, 'tickLower'); if (isErr(tickLower)) return { status: 'error', code: 'INVALID_PARAMS', message: tickLower.error };
    const tickUpper = num(args, 'tickUpper'); if (isErr(tickUpper)) return { status: 'error', code: 'INVALID_PARAMS', message: tickUpper.error };
    const balance0 = bi(args, 'balance0'); if (isErr(balance0)) return { status: 'error', code: 'INVALID_PARAMS', message: balance0.error };
    const balance1 = bi(args, 'balance1'); if (isErr(balance1)) return { status: 'error', code: 'INVALID_PARAMS', message: balance1.error };

    if (tickLower >= tickUpper) return { status: 'error', code: 'INVALID_PARAMS', message: 'tickLower must be less than tickUpper' };

    try {
      const authToken = deps.getAuthToken();
      const result = await calculateOnServer('calcAllocationSnapshot', {
        currentTick,
        tickLower,
        tickUpper,
        balance0: balance0.toString(),
        balance1: balance1.toString(),
      }, authToken);

      const snapshot = depositSnapshotResult(result);
      if (isErr(snapshot)) return { status: 'error', code: 'CALC_ERROR', message: snapshot.error };

      return {
        status: 'success',
        data: {
          amount0: snapshot.maxDeposit.amount0,
          amount1: snapshot.maxDeposit.amount1,
          cappedBy: snapshot.maxDeposit.cappedBy,
          disabledSide: snapshot.disabledSide,
          swapNeeded: snapshot.zapPlan.kind === 'swap_required',
          swapDirection: snapshot.zapPlan.kind === 'swap_required' ? snapshot.zapPlan.direction : null,
          swapAmountIn: snapshot.zapPlan.kind === 'swap_required' ? snapshot.zapPlan.amountIn : null,
        },
      };
    } catch (e) { // @ci-exception(no-empty-catch) /* calculation boundary returns ToolResult error envelope */
      return { status: 'error', code: 'CALC_ERROR', message: e instanceof Error ? e.message : String(e) };
    }
  };
}

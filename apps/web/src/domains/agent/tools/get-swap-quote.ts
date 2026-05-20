/**
 * get_swap_quote tool handler — v1.58.21
 *
 * FE direct aggregator 호출.
 * v1.58.21: quoteId 캐싱 제거 — prepare_swap_tx 삭제에 따라 불필요.
 *           AI는 quotes를 compose_pipeline의 swap atom params로 직접 전달.
 */

import type { ToolResult } from '@hq/react/agent';
import type { ToolContext } from './BrowserToolRegistry';
import type { RegistryDeps } from './index';
import { swapSelector } from '@hq/core/defi/routing';
import type { SwapQuoteParams, SwapQuote } from '@hq/core/defi/routing';
import { addrFromString, isErr } from './helpers';
import { resolveTokenConfigOrThrow } from '@hq/react/token';

function serializeQuote(q: SwapQuote): Record<string, unknown> {
  return {
    aggregator: q.aggregator,
    amountOut: q.amountOut.toString(),
    minAmountOut: q.minAmountOut.toString(),
    priceImpact: q.priceImpact,
    routerAddress: q.execution.kind === 'same-chain' ? q.execution.routerAddress : null,
    spenderAddress: q.execution.kind === 'same-chain' ? q.execution.spenderAddress : null,
    calldata: q.execution.kind === 'same-chain' ? q.execution.calldata : null,
    executionKind: q.execution.kind,
  };
}

export function createGetSwapQuoteHandler(_deps: RegistryDeps) {
  return async function getSwapQuoteHandler(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const chainId = args['chainId'];
    const tokenIn = args['tokenIn'];
    const tokenOut = args['tokenOut'];
    const amountIn = args['amountIn'];
    const userAddress = args['userAddress'];

    if (!chainId || !tokenIn || !tokenOut || !amountIn || !userAddress) {
      return { status: 'error', code: 'MISSING_PARAM', message: 'chainId, tokenIn, tokenOut, amountIn, userAddress are all required' };
    }

    const slippageBps = typeof args['slippageBps'] === 'number' ? args['slippageBps'] : 50;

    const tokenInAddr = addrFromString(String(tokenIn), 'tokenIn');
    if (isErr(tokenInAddr)) return { status: 'error', code: 'INVALID_PARAM', message: tokenInAddr.error };
    const tokenOutAddr = addrFromString(String(tokenOut), 'tokenOut');
    if (isErr(tokenOutAddr)) return { status: 'error', code: 'INVALID_PARAM', message: tokenOutAddr.error };
    const senderAddr = addrFromString(String(userAddress), 'userAddress');
    if (isErr(senderAddr)) return { status: 'error', code: 'INVALID_PARAM', message: senderAddr.error };
    const resolvedChainId = Number(chainId);
    const tokenInConfig = resolveTokenConfigOrThrow(resolvedChainId, tokenInAddr);
    const tokenOutConfig = resolveTokenConfigOrThrow(resolvedChainId, tokenOutAddr);

    const quoteParams: SwapQuoteParams = {
      origin: {
        address: tokenInAddr,
        chainId: resolvedChainId,
        decimals: tokenInConfig.decimals,
        isNative: tokenInConfig.tokenType === 'native',
      },
      destination: {
        address: tokenOutAddr,
        chainId: resolvedChainId,
        decimals: tokenOutConfig.decimals,
        isNative: tokenOutConfig.tokenType === 'native',
      },
      amountIn: BigInt(String(amountIn)),
      slippageBps,
      sender: senderAddr,
    };

    try {
      const quotes = await swapSelector.getQuotes(quoteParams);
      const serialized = quotes.map(serializeQuote);
      return { status: 'success', data: { quotes: serialized, count: serialized.length } };
    } catch (err) { // @ci-exception(no-empty-catch) /* quote fetch boundary returns ToolResult error envelope */
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'error', code: 'QUOTE_ERROR', message: `Failed to fetch swap quote: ${message}` };
    }
  };
}

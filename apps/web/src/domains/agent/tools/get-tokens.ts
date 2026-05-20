/**
 * get_tokens + get_token_detail tools (v1.56.16)
 *
 * get_tokens: 체인별 토큰 목록 (symbol + address compact).
 * get_token_detail: 주소 목록으로 상세 정보 조회 (decimals, name, tokenType).
 */
import { useTokenConfigStore } from '@hq/react/token';
import type { BrowserToolHandler } from './BrowserToolRegistry';

export function createGetTokensHandler(): BrowserToolHandler {
  return async (args) => {
    const chainId = args['chainId'];
    if (typeof chainId !== 'number') {
      return { status: 'error', code: 'MISSING_PARAM', message: 'chainId is required' };
    }

    const tokens = useTokenConfigStore.getState().getTokensByChain(chainId);
    const data = tokens.map((t) => ({ symbol: t.symbol, address: t.address }));
    return { status: 'success', data };
  };
}

export function createGetTokenDetailHandler(): BrowserToolHandler {
  return async (args) => {
    const chainId = args['chainId'];
    if (typeof chainId !== 'number') {
      return { status: 'error', code: 'MISSING_PARAM', message: 'chainId is required' };
    }
    const addresses = args['addresses'];
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return { status: 'error', code: 'MISSING_PARAM', message: 'addresses (string array) is required' };
    }
    if (addresses.length > 20) {
      return { status: 'error', code: 'INVALID_PARAM', message: 'addresses max 20' };
    }

    const addrSet = new Set(addresses.map((a) => String(a).toLowerCase()));
    const matched = useTokenConfigStore.getState().getTokensByChain(chainId).filter(
      (t) => addrSet.has(t.address.toLowerCase()),
    );

    const data = matched.map((t) => ({
      chainId: t.chainId,
      symbol: t.symbol,
      address: t.address,
      decimals: t.decimals,
      name: t.name,
      tokenType: t.tokenType,
    }));

    return { status: 'success', data };
  };
}

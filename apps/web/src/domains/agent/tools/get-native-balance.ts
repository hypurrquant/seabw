/**
 * get_native_balance — 체인별 native coin(가스 토큰) 잔액 조회
 *
 * v1.58.21: 신규. AI가 gas 잔액을 확인할 수 있도록.
 * viem getBalance + chain.nativeCurrency 메타데이터 반환.
 */

import type { ToolResult } from '@hq/react/agent';
import type { BrowserToolHandler } from './BrowserToolRegistry';
import type { RegistryDeps } from './index';
import { SUPPORTED_CHAINS } from '@hq/core/config/chains';
import { formatUnits } from 'viem';
import { assertHex } from '@hq/core/lib/type-guard';

function getNativeCurrency(chainId: number): { symbol: string; name: string; decimals: number } | null {
  for (const entry of Object.values(SUPPORTED_CHAINS)) {
    if (entry.chain.id === chainId) {
      return entry.chain.nativeCurrency;
    }
  }
  return null;
}

export function createGetNativeBalanceHandler(deps: RegistryDeps): BrowserToolHandler {
  return async (args: Record<string, unknown>): Promise<ToolResult> => {
    const rawChainId = args['chainId'];
    if (rawChainId === undefined || rawChainId === null) {
      return { status: 'error', code: 'MISSING_PARAM', message: 'chainId is required' };
    }
    const chainId = Number(rawChainId);

    // address: 제공되면 사용, 아니면 연결된 지갑
    let address: `0x${string}`;
    if (args['address'] && typeof args['address'] === 'string') {
      address = assertHex(args['address']);
    } else {
      const account = deps.getActiveAccount();
      if (!account.activeAddress) {
        return { status: 'error', code: 'NO_WALLET', message: 'Wallet not connected. Provide address or connect wallet.' };
      }
      address = account.activeAddress;
    }

    const native = getNativeCurrency(chainId);
    if (!native) {
      return { status: 'error', code: 'UNSUPPORTED_CHAIN', message: `Chain ${chainId} is not supported` };
    }

    try {
      const client = deps.getPublicClient(chainId);
      const balanceWei = await client.getBalance({ address });
      const balanceFormatted = formatUnits(balanceWei, native.decimals);

      return {
        status: 'success',
        data: {
          chainId,
          address,
          symbol: native.symbol,
          name: native.name,
          decimals: native.decimals,
          balanceWei: balanceWei.toString(),
          balance: balanceFormatted,
        },
      };
    } catch (e) { // @ci-exception(no-empty-catch) /* error propagated via return { status: 'error' } */
      const msg = e instanceof Error ? e.message : 'Unknown error';
      return { status: 'error', code: 'RPC_ERROR', message: `Failed to fetch native balance: ${msg}` };
    }
  };
}

/**
 * get_token_balances — fresh RPC 직접 조회 (v1.56.8)
 * NATIVE_SENTINEL 지원: 0xeee...eee → getBalance, 나머지 → ERC20 balanceOf
 */
import type { ToolResult } from '@hq/react/agent';
import type { BrowserToolHandler } from './BrowserToolRegistry';
import type { RegistryDeps } from './index';
import { num, addr, isErr, addrFromString } from './helpers';

import { ERC20_ABI } from '@hq/core/defi/lp/abi/erc20';
import { executePlan, taggedPlan } from '@hq/core/lib/multicall';

const NATIVE_SENTINEL = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export function createGetTokenBalancesHandler(deps: RegistryDeps): BrowserToolHandler {
  return async (args: Record<string, unknown>): Promise<ToolResult> => {
    const chainId = num(args, 'chainId');
    if (isErr(chainId)) return { status: 'error', code: 'MISSING_PARAM', message: chainId.error };
    const owner = addr(args, 'owner');
    if (isErr(owner)) return { status: 'error', code: 'MISSING_PARAM', message: owner.error };

    const rawTokens = args['tokens'];
    if (!Array.isArray(rawTokens)) {
      return { status: 'error', code: 'MISSING_PARAM', message: 'tokens (string array) is required' };
    }
    const tokens: string[] = rawTokens.map(String);

    if (tokens.length === 0) {
      return { status: 'success', data: {} };
    }

    const client = deps.getPublicClient(chainId);

    const balances: Record<string, string> = {};

    // native 토큰 분리 — getBalance는 multicall 대상이 아님
    const nativeTokens: string[] = [];
    const erc20Entries: { address: `0x${string}`; tokenAddr: string }[] = [];

    for (const token of tokens) {
      const tokenAddr = token.toLowerCase();
      if (tokenAddr === NATIVE_SENTINEL) {
        nativeTokens.push(tokenAddr);
      } else {
        const contractAddr = addrFromString(token, 'token');
        if (isErr(contractAddr)) {
          return { status: 'error', code: 'INVALID_PARAM', message: contractAddr.error };
        }
        erc20Entries.push({ address: contractAddr, tokenAddr });
      }
    }

    // native balance 조회 (getBalance — multicall 불가)
    for (const tokenAddr of nativeTokens) {
      const balance = await client.getBalance({ address: owner });
      balances[tokenAddr] = balance.toString();
    }

    // ERC20 balanceOf — taggedPlan + executePlan
    if (erc20Entries.length > 0) {
      const plan = taggedPlan(ERC20_ABI, 'balanceOf', erc20Entries.map(e => ({
        address: e.address,
        args: [owner],
        tag: e.tokenAddr,
      })));
      const results = await executePlan({ chainId, feature: 'portfolio' }, plan);
      if (results) {
        for (const entry of results) {
          balances[entry.tag] = (entry.value ?? 0n).toString();
        }
      }
    }

    return { status: 'success', data: balances };
  };
}

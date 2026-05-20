/**
 * get_wallet_status — 지갑 연결 상태 조회 (v1.56.8)
 */
import type { ToolResult } from '@hq/react/agent';
import type { BrowserToolHandler } from './BrowserToolRegistry';
import type { RegistryDeps } from './index';

export function createGetWalletStatusHandler(deps: RegistryDeps): BrowserToolHandler {
  return async (): Promise<ToolResult> => {
    const account = deps.getActiveAccount();
    return {
      status: 'success',
      data: {
        activeAddress: account.activeAddress,
        executionMode: account.executionMode,
        ready: account.ready,
      },
    };
  };
}

/**
 * Boundary Default Resolve (v1.57.1).
 *
 * prepare_* tool handler에서 pipeline server가 요구하는 context-dependent 필드를
 * active account에서 파생하는 유틸리티.
 */
import type { ToolResult } from '@hq/react/agent';

/**
 * 현재 활성 지갑 주소를 반환.
 * 미연결 시 ACCOUNT_NOT_READY 에러 ToolResult를 반환.
 */
export function resolveActiveAddress(
  getActiveAccount: () => { activeAddress: `0x${string}` | null },
): `0x${string}` | ToolResult {
  const account = getActiveAccount();
  if (account.activeAddress === null) {
    return { status: 'error', code: 'ACCOUNT_NOT_READY', message: 'Wallet not connected' };
  }
  return account.activeAddress;
}


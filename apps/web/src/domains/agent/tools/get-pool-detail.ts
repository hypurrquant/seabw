import type { ToolResult } from '@hq/react/agent';
import { z } from 'zod';
import { http } from '@hq/core/lib/http';


export async function getPoolDetailHandler(args: Record<string, unknown>): Promise<ToolResult> {
  const poolIds = args['poolIds'];
  if (!Array.isArray(poolIds) || poolIds.length === 0) {
    return { status: 'error', code: 'MISSING_PARAM', message: 'poolIds (string array) is required' };
  }
  if (poolIds.length > 10) {
    return { status: 'error', code: 'INVALID_PARAM', message: 'poolIds max 10' };
  }

  const results = await Promise.all(
    poolIds.map(async (id) => {
      try {
        return await http<unknown>(`/api/v1/pools/${encodeURIComponent(String(id))}`, { schema: z.unknown() });
      } catch { // @ci-exception(no-empty-catch) /* per-pool detail fetch 실패 — partial success */
        return { poolId: id, error: 'fetch failed' };
      }
    }),
  );

  return { status: 'success', data: results };
}

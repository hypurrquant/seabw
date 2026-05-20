import type { ToolResult } from '@hq/react/agent';
import { z } from 'zod';
import { http } from '@hq/core/lib/http';


export async function getTickDataHandler(args: Record<string, unknown>): Promise<ToolResult> {
  const poolIds = args['poolIds'];
  if (!Array.isArray(poolIds) || poolIds.length === 0) {
    return { status: 'error', code: 'MISSING_PARAM', message: 'poolIds (string array) is required' };
  }
  if (poolIds.length > 5) {
    return { status: 'error', code: 'INVALID_PARAM', message: 'poolIds max 5 (tick data is large)' };
  }

  const results = await Promise.all(
    poolIds.map(async (id) => {
      try {
        return await http<unknown>(`/api/v1/ticks/${encodeURIComponent(String(id))}`, { schema: z.unknown() });
      } catch { // @ci-exception(no-empty-catch) /* per-pool tick fetch 실패 — partial success */
        return { poolId: id, error: 'fetch failed' };
      }
    }),
  );

  return { status: 'success', data: results };
}

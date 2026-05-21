/**
 * BrowserToolRegistry (v1.56.18).
 *
 * Tool handler를 브라우저에서 관리. Schema는 MCP server에만 존재.
 * LLM이 tool call을 하면 Browser가 이 registry를 통해 직접 실행.
 *
 * v1.56.18: schema 제거 — handler-only Map. Schema SSOT = MCP server.
 */

import type { ToolResult, ToolRegistry, ToolContext } from '@hq/react/agent';

export type { ToolContext } from '@hq/react/agent';

export type BrowserToolHandler = (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;

export class BrowserToolRegistry implements ToolRegistry {
  private readonly handlers = new Map<string, BrowserToolHandler>();

  register(name: string, handler: BrowserToolHandler): void {
    this.handlers.set(name, handler);
  }

  async execute(name: string, args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const t0 = performance.now();
    const callId = (context as { toolCallId?: string }).toolCallId ?? "(no-id)";
    console.groupCollapsed(`%c[tool] ▶ ${name}`, "color:#7ee787", { callId, args });
    const handler = this.handlers.get(name);
    if (!handler) {
      const result: ToolResult = { status: 'error', code: 'TOOL_NOT_FOUND', message: `Unknown tool: ${name}` };
      console.warn(`[tool] ✗ ${name} TOOL_NOT_FOUND — registered tools:`, Array.from(this.handlers.keys()));
      console.groupEnd();
      return result;
    }
    try {
      const result = await handler(args, context);
      const dt = Math.round(performance.now() - t0);
      if (result.status === "error") {
        console.warn(`[tool] ✗ ${name} ${dt}ms`, { code: result.code, message: result.message });
      } else if (result.status === "success") {
        console.info(`[tool] ✓ ${name} ${dt}ms`, { data: result.data });
      } else {
        console.info(`[tool] ✓ ${name} ${dt}ms`, result);
      }
      console.groupEnd();
      return result;
    } catch (err) { // @ci-exception(no-empty-catch) /* tool boundary converts thrown error to ToolResult */
      const message = err instanceof Error ? err.message : String(err);
      const dt = Math.round(performance.now() - t0);
      console.error(`[tool] ✗ ${name} THREW ${dt}ms`, err);
      console.groupEnd();
      return { status: 'error', code: 'TOOL_EXECUTION_ERROR', message };
    }
  }
}

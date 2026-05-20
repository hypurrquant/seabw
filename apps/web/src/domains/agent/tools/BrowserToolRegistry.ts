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
    const handler = this.handlers.get(name);
    if (!handler) {
      return { status: 'error', code: 'TOOL_NOT_FOUND', message: `Unknown tool: ${name}` };
    }
    try {
      return await handler(args, context);
    } catch (err) { // @ci-exception(no-empty-catch) /* tool boundary converts thrown error to ToolResult */
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'error', code: 'TOOL_EXECUTION_ERROR', message };
    }
  }
}

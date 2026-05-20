/**
 * ServerProxyProvider (v1.56.6).
 *
 * AI Gateway(서버)를 통해 codex CLI에 접근하는 Provider.
 * SSE로 스트리밍 수신 + tool_call 이벤트 시 onToolCall 콜백 실행 + tool-result 전송.
 */

import type { AIProvider, AIStreamEvent, LLMMessage, ToolCall, ToolResult } from '@hq/react/agent';
import type { ApiResponse } from '@hq/core/lib/http';
import { http, postEventStream } from '@hq/core/lib/http';
import { useAgentStore } from '@hq/react/agent';
import { AGENT_API_BASE } from '../config';


export class ServerProxyProvider implements AIProvider {
  private readonly baseUrl: string;

  constructor(baseUrl: string = AGENT_API_BASE) {
    this.baseUrl = baseUrl;
  }

  async *chat(params: {
    messages: ReadonlyArray<LLMMessage>;
    sessionId: string;
    signal: AbortSignal;
    onToolCall: (call: ToolCall) => Promise<ToolResult>;
  }): AsyncIterable<AIStreamEvent> {
    // codex CLI가 이력을 관리하므로 마지막 유저 메시지만 전송
    const lastUserMessage = params.messages
      .filter((m): m is Extract<LLMMessage, { role: 'user' }> => m.role === 'user')
      .at(-1)?.content ?? '';

    const token = this.getToken();
    const response = await postEventStream(
      `${this.baseUrl}/agent/chat`,
      {
        message: lastUserMessage,
        sessionId: params.sessionId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: params.signal,
      },
    );

    if (!response.ok) {
      yield { type: 'error', message: `HTTP ${response.status}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', message: 'Missing response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let currentEvent = '';
      let currentData = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6).trim();
        } else if (line === '') {
          if (currentEvent) {
            const parsed = currentData ? JSON.parse(currentData) : {};

            if (currentEvent === 'stream') {
              yield { type: 'text', delta: parsed.delta ?? '' };
            } else if (currentEvent === 'tool_call') {
              const call: ToolCall = {
                toolCallId: parsed.toolCallId,
                name: parsed.toolName,
                args: parsed.args ?? {},
              };

              yield { type: 'tool_call', ...call };

              // Browser가 tool 실행
              const result = await params.onToolCall(call);

              // 결과를 서버에 전송 (sessionId + toolCallId 복합키)
              await http<ApiResponse<{ readonly received: boolean }>>(`${this.baseUrl}/agent/tool-result`, {
                internal: true,
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  sessionId: params.sessionId,
                  toolCallId: call.toolCallId,
                  result,
                }),
              });

              yield { type: 'tool_result', toolCallId: call.toolCallId, result };
            } else if (currentEvent === 'tool_done') {
              // 서버가 LLM에 결과 주입 후 발행 — 무시 (이미 tool_result로 처리)
            } else if (currentEvent === 'title_update') {
              yield { type: 'title_update' as const, title: parsed.title ?? '' };
            } else if (currentEvent === 'done') {
              yield { type: 'done' };
            } else if (currentEvent === 'error') {
              yield { type: 'error', message: parsed.message ?? 'Unknown error' };
              return; // generator 즉시 종료 — isStreaming stuck 방지
            }

            currentEvent = '';
            currentData = '';
          }
        }
      }
    }
  }

  private getToken(): string {
    return useAgentStore.getState().auth.token ?? '';
  }
}

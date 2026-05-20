import { Injectable, Logger } from "@nestjs/common";
import { Observable, Subscriber } from "rxjs";
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { AgentLLMPort } from "../domain/agent-llm.port";
import type { AgentSSEEvent, LLMMessage } from "../domain/agent.types";

/**
 * ACPX LLM 어댑터.
 *
 * acpx CLI를 spawn해 codex-acp(Zed)에 JSON-RPC로 prompt를 전달하고, 응답을
 * AgentSSEEvent로 매핑한다. MCP tool/tool_call 처리는 이번 phase에서는 비범위 —
 * tool_call sessionUpdate는 swallow한다.
 */
@Injectable()
export class AcpxLLMAdapter extends AgentLLMPort {
  private readonly logger = new Logger(AcpxLLMAdapter.name);

  chat(params: {
    systemPrompt: string;
    messages: ReadonlyArray<LLMMessage>;
    context: { sessionKey: string };
    signal?: AbortSignal;
  }): Observable<AgentSSEEvent> {
    return new Observable((subscriber) => {
      const child = this.spawnAcpx(params, params.context.sessionKey, subscriber);
      const onAbort = (): void => {
        if (child && !child.killed) child.kill("SIGTERM");
      };
      if (params.signal) {
        if (params.signal.aborted) onAbort();
        else params.signal.addEventListener("abort", onAbort, { once: true });
      }
      return () => {
        if (params.signal) params.signal.removeEventListener("abort", onAbort);
        if (child && !child.killed) child.kill("SIGTERM");
      };
    });
  }

  private spawnAcpx(
    params: { systemPrompt: string; messages: ReadonlyArray<LLMMessage> },
    sessionKey: string,
    subscriber: Subscriber<AgentSSEEvent>,
  ): ChildProcess | null {
    let child: ChildProcess;
    try {
      child = spawn(
        "acpx",
        [
          "--format",
          "json",
          "--json-strict",
          "--cwd",
          "/tmp/codex-workspace",
          "--approve-all",
          "--non-interactive-permissions",
          "deny",
          "exec",
          "--file",
          "-",
        ],
        {
          stdio: ["pipe", "pipe", "pipe"],
          env: {
            ...process.env,
            TOOL_CONTEXT_SESSION_KEY: sessionKey,
          },
        },
      );
    } catch (err) {
      subscriber.next({
        event: "error",
        data: { code: "ACPX_SPAWN", message: `Failed to spawn acpx: ${(err as Error).message}` },
      });
      subscriber.complete();
      return null;
    }

    const prompt = this.buildPrompt(params.systemPrompt, params.messages);
    if (child.stdin) {
      child.stdin.write(prompt);
      setTimeout(() => child.stdin?.end(), 100);
    }

    subscriber.next({ event: "typing" });

    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      this.logger.debug(`acpx stderr: ${text.slice(0, 300)}`);
      stderr += text;
    });

    if (child.stdout) {
      const lines = createInterface({ input: child.stdout });
      lines.on("line", (line: string) => {
        if (!line.trim()) return;
        try {
          const event = JSON.parse(line) as Record<string, unknown>;
          this.mapEvent(event, subscriber);
        } catch {
          subscriber.next({ event: "stream", data: { delta: line + "\n" } });
        }
      });
    }

    let resolved = false;
    const doComplete = (code: number | null): void => {
      if (resolved) return;
      resolved = true;
      if (code !== 0 && code !== null) {
        subscriber.next({
          event: "error",
          data: {
            code: "ACPX_EXIT",
            message: stderr.trim() || `acpx exited with code ${code}`,
          },
        });
      }
      subscriber.next({ event: "done", data: { sessionId: sessionKey } });
      subscriber.complete();
    };

    child.on("close", (code) => doComplete(code));
    child.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      subscriber.next({
        event: "error",
        data: {
          code: "ACPX_SPAWN",
          message: `Failed to spawn acpx: ${err.message}`,
        },
      });
      subscriber.complete();
    });

    return child;
  }

  private mapEvent(event: Record<string, unknown>, subscriber: Subscriber<AgentSSEEvent>): void {
    const method = event["method"] as string | undefined;
    const params = event["params"] as Record<string, unknown> | undefined;
    const result = event["result"] as Record<string, unknown> | undefined;
    if (result) return;
    if (method !== "session/update" || !params) return;
    const update = params["update"] as Record<string, unknown> | undefined;
    if (!update) return;
    const sessionUpdate = update["sessionUpdate"] as string;
    if (sessionUpdate === "agent_message_chunk") {
      const content = update["content"] as Record<string, unknown> | undefined;
      if (content?.["type"] === "text") {
        subscriber.next({
          event: "stream",
          data: { delta: String(content["text"] ?? "") },
        });
      }
    }
    // tool_call / tool_result / usage_update — swallowed (MCP not used here).
  }

  private buildPrompt(systemPrompt: string, messages: ReadonlyArray<LLMMessage>): string {
    const parts = [systemPrompt, ""];
    if (messages.length === 0) {
      throw new Error("buildPrompt requires at least one message");
    }
    if (messages.length <= 1) {
      parts.push("## User Request", messages[0].content);
    } else {
      parts.push("## Conversation History");
      for (const msg of messages) {
        const label = msg.role === "user" ? "User" : "Assistant";
        parts.push(`\n### ${label}`, msg.content);
      }
      parts.push("\n## Instructions", "Continue the conversation. The last User message is the current request.");
    }
    return parts.join("\n");
  }
}

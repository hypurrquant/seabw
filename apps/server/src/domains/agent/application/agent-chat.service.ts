import { Injectable, Logger } from "@nestjs/common";
import { Subject } from "rxjs";
import { AgentLLMPort } from "../domain/agent-llm.port";
import { AgentSessionPort } from "../domain/agent-session.port";
import type { AgentSSEEvent, LLMMessage } from "../domain/agent.types";
import { SessionQueueManager } from "./message-queue";

const DEFAULT_SYSTEM_PROMPT = `You are seabw's DeFi co-pilot. Help the user reason about safe yield strategies based on their tier and current market context. Be concise, accurate, and explicit about uncertainty.`;

@Injectable()
export class AgentChatService {
  private readonly logger = new Logger(AgentChatService.name);
  private readonly queue = new SessionQueueManager();

  constructor(
    private readonly llm: AgentLLMPort,
    private readonly sessions: AgentSessionPort,
  ) {}

  chat(input: { sessionId: string; message: string; systemPrompt?: string }): Subject<AgentSSEEvent> {
    const subject = new Subject<AgentSSEEvent>();
    this.queue
      .enqueue(input.sessionId, () => this.handle(input, subject))
      .catch((err) => {
        this.logger.error(`chat handler crashed: ${(err as Error).message}`);
        subject.next({
          event: "error",
          data: { code: "INTERNAL", message: (err as Error).message },
        });
        subject.complete();
      });
    return subject;
  }

  private async handle(
    input: { sessionId: string; message: string; systemPrompt?: string },
    subject: Subject<AgentSSEEvent>,
  ): Promise<void> {
    let history = await this.sessions.getMessages(input.sessionId);
    if (history.length === 0) {
      // Auto-create session if it doesn't exist yet — sessionId is opaque to client.
      const s = await this.sessions.get(input.sessionId);
      if (!s) {
        // Best-effort: client may have supplied an unknown sessionId.
        // Create-on-demand mode keeps the SSE contract simple.
      }
      history = [];
    }
    const messages: LLMMessage[] = [
      ...history.map((m) => ({ role: (m.role as LLMMessage["role"]), content: m.content }) as LLMMessage),
      { role: "user" as const, content: input.message },
    ];

    let assistantContent = "";
    let errored = false;
    const obs = this.llm.chat({
      systemPrompt: input.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      messages,
      context: { sessionKey: input.sessionId },
    });

    await new Promise<void>((resolve) => {
      const sub = obs.subscribe({
        next: (event) => {
          subject.next(event);
          if (event.event === "stream") assistantContent += event.data.delta;
          if (event.event === "error") errored = true;
        },
        error: (err: unknown) => {
          subject.next({
            event: "error",
            data: { code: "LLM_ERROR", message: (err as Error).message },
          });
          errored = true;
          resolve();
        },
        complete: () => {
          sub.unsubscribe();
          resolve();
        },
      });
    });

    if (!errored && assistantContent) {
      await this.sessions.appendMessage(input.sessionId, { role: "user", content: input.message });
      await this.sessions.appendMessage(input.sessionId, {
        role: "assistant",
        content: assistantContent,
      });
    }
    subject.complete();
  }
}

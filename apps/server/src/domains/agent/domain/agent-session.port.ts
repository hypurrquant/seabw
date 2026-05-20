import type { AgentSession } from "./agent.types";

export abstract class AgentSessionPort {
  abstract create(owner: string): Promise<AgentSession>;
  abstract get(sessionId: string): Promise<AgentSession | null>;
  abstract listByOwner(owner: string): Promise<ReadonlyArray<AgentSession>>;
  abstract delete(sessionId: string, owner: string): Promise<boolean>;
  abstract appendMessage(sessionId: string, msg: { role: string; content: string }): Promise<void>;
  abstract getMessages(sessionId: string): Promise<ReadonlyArray<{ role: string; content: string }>>;
  abstract updateTitle(sessionId: string, title: string): Promise<void>;
}

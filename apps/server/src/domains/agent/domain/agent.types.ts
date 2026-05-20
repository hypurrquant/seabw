// Wire-format re-exports from core (web/server SSOT)
export type {
  AgentChatRequest,
  AgentSSEEvent,
  AgentSessionDTO,
  AgentSessionMessageDTO as SessionMessageDTO,
} from "@seabw/core";

// ── Server-internal types ────────────────────────────────

export type LLMMessage =
  | { readonly role: "system"; readonly content: string }
  | { readonly role: "user"; readonly content: string }
  | { readonly role: "assistant"; readonly content: string }
  | { readonly role: "tool"; readonly content: string; readonly toolCallId: string; readonly name: string };

export type AgentTokenPayload = {
  readonly walletAddress: string;
  readonly expiresAt: number;
};

export interface AgentSession {
  sessionId: string;
  owner: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

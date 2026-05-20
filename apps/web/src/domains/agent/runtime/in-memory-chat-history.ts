import type { ChatHistoryPort, ChatMessage } from "@hq/react/agent";

export class InMemoryChatHistoryAdapter implements ChatHistoryPort {
  private readonly messagesBySession = new Map<string, ReadonlyArray<ChatMessage>>();

  async getAll(sessionId: string): Promise<ReadonlyArray<ChatMessage>> {
    return this.messagesBySession.get(sessionId) ?? [];
  }
}

import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AgentSessionPort } from "../domain/agent-session.port";
import type { AgentSession } from "../domain/agent.types";

interface StoredSession extends AgentSession {
  messages: { role: string; content: string; ts: string }[];
}

@Injectable()
export class InMemorySessionAdapter extends AgentSessionPort {
  private readonly sessions = new Map<string, StoredSession>();

  async create(owner: string): Promise<AgentSession> {
    const now = new Date();
    const session: StoredSession = {
      sessionId: randomUUID(),
      owner: owner.toLowerCase(),
      title: "New conversation",
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  async get(sessionId: string): Promise<AgentSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async listByOwner(owner: string): Promise<ReadonlyArray<AgentSession>> {
    const key = owner.toLowerCase();
    return Array.from(this.sessions.values()).filter((s) => s.owner === key);
  }

  async delete(sessionId: string, owner: string): Promise<boolean> {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    if (s.owner !== owner.toLowerCase()) return false;
    return this.sessions.delete(sessionId);
  }

  async appendMessage(sessionId: string, msg: { role: string; content: string }): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.messages.push({ ...msg, ts: new Date().toISOString() });
    s.updatedAt = new Date();
  }

  async getMessages(sessionId: string): Promise<ReadonlyArray<{ role: string; content: string }>> {
    const s = this.sessions.get(sessionId);
    return s ? s.messages.map((m) => ({ role: m.role, content: m.content })) : [];
  }

  async updateTitle(sessionId: string, title: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.title = title;
    s.updatedAt = new Date();
  }
}

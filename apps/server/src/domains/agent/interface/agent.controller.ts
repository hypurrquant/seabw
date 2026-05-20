import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Sse,
  UsePipes,
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { map, type Observable } from "rxjs";
import type {
  AgentChatRequest,
  AgentSessionDTO,
  AgentSSEEvent,
  ApiResponse,
  AgentSessionMessageDTO,
} from "@seabw/core";
import { AgentChatService } from "../application/agent-chat.service";
import { AgentSessionPort } from "../domain/agent-session.port";
import { ZodValidationPipe } from "../../../common/zod-validation.pipe";
import { ok } from "../../../common/api-response.util";

const ChatSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1).max(8000),
});

interface MessageEvent {
  data: string;
  event?: string;
}

function toMessageEvent(e: AgentSSEEvent): MessageEvent {
  return { event: e.event, data: JSON.stringify("data" in e ? e.data : {}) };
}

function ownerOfReq(req: Request): string {
  return (req as Request & { agentWallet?: string }).agentWallet?.toLowerCase() ?? "0xdev";
}

@Controller("/agent")
export class AgentController {
  constructor(
    private readonly chat: AgentChatService,
    private readonly sessions: AgentSessionPort,
  ) {}

  @Post("chat")
  @Sse()
  @UsePipes(new ZodValidationPipe(ChatSchema))
  chatStream(@Body() body: AgentChatRequest): Observable<MessageEvent> {
    return this.chat.chat({ sessionId: body.sessionId, message: body.message }).pipe(map(toMessageEvent));
  }

  @Post("sessions")
  async createSession(@Req() req: Request): Promise<ApiResponse<AgentSessionDTO>> {
    const owner = ownerOfReq(req);
    const s = await this.sessions.create(owner);
    return ok({
      sessionId: s.sessionId,
      owner: s.owner,
      title: s.title,
      createdAt: s.createdAt.toISOString(),
    });
  }

  @Get("sessions")
  async listSessions(@Req() req: Request): Promise<ApiResponse<AgentSessionDTO[]>> {
    const owner = ownerOfReq(req);
    const list = await this.sessions.listByOwner(owner);
    return ok(
      list.map((s) => ({
        sessionId: s.sessionId,
        owner: s.owner,
        title: s.title,
        createdAt: s.createdAt.toISOString(),
      })),
    );
  }

  @Get("sessions/:id/messages")
  async getMessages(@Param("id") id: string): Promise<ApiResponse<AgentSessionMessageDTO[]>> {
    const msgs = await this.sessions.getMessages(id);
    return ok(
      msgs.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        ts: new Date().toISOString(),
      })),
    );
  }

  @Delete("sessions/:id")
  async delete(@Param("id") id: string, @Req() req: Request): Promise<ApiResponse<{ deleted: boolean }>> {
    const owner = ownerOfReq(req);
    const deleted = await this.sessions.delete(id, owner);
    return ok({ deleted });
  }
}

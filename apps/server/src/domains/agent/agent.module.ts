import { Module } from "@nestjs/common";
import { AgentController } from "./interface/agent.controller";
import { AgentAuthGuard } from "./interface/agent-auth.guard";
import { AgentChatService } from "./application/agent-chat.service";
import { IntentService } from "./application/intent.service";
import { AgentLLMPort } from "./domain/agent-llm.port";
import { AgentSessionPort } from "./domain/agent-session.port";
import { AgentAuthPort } from "./domain/agent-auth.port";
import { AcpxLLMAdapter } from "./infrastructure/acpx-llm.adapter";
import { InMemorySessionAdapter } from "./infrastructure/in-memory-session.adapter";
import { DevStubAuthAdapter } from "./infrastructure/dev-stub-auth.adapter";

@Module({
  controllers: [AgentController],
  providers: [
    AgentChatService,
    AgentAuthGuard,
    IntentService,
    { provide: AgentLLMPort, useClass: AcpxLLMAdapter },
    { provide: AgentSessionPort, useClass: InMemorySessionAdapter },
    { provide: AgentAuthPort, useClass: DevStubAuthAdapter },
  ],
  exports: [AgentLLMPort, AgentSessionPort, AgentAuthPort, AgentAuthGuard, IntentService],
})
export class AgentModule {}

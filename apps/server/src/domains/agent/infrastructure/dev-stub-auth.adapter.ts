import { Injectable, Logger } from "@nestjs/common";
import { AgentAuthPort } from "../domain/agent-auth.port";
import type { AgentTokenPayload } from "../domain/agent.types";

/**
 * Dev-only stub auth. All tokens validate to a fixed `dev` wallet. DO NOT use
 * in production — phase v1.0.0 explicitly defers real auth.
 */
@Injectable()
export class DevStubAuthAdapter extends AgentAuthPort {
  private readonly logger = new Logger(DevStubAuthAdapter.name);
  private warned = false;

  private warnOnce(): void {
    if (this.warned) return;
    this.warned = true;
    this.logger.warn("DEV STUB AUTH — DO NOT USE IN PROD");
  }

  async createChallenge(_address: string): Promise<string> {
    this.warnOnce();
    return "stub-challenge";
  }

  async verifySignature(_address: string, _challenge: string, _signature: string): Promise<boolean> {
    this.warnOnce();
    return true;
  }

  createToken(_walletAddress: string): string {
    this.warnOnce();
    return "stub-token";
  }

  validateToken(token: string): AgentTokenPayload | null {
    this.warnOnce();
    if (!token) return null;
    return {
      walletAddress: "0xdev",
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
  }
}

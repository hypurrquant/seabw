import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AgentAuthPort } from "../domain/agent-auth.port";

@Injectable()
export class AgentAuthGuard implements CanActivate {
  constructor(private readonly auth: AgentAuthPort) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers["authorization"];
    const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new UnauthorizedException({ error: "Missing bearer token" });
    const payload = this.auth.validateToken(token);
    if (!payload) throw new UnauthorizedException({ error: "Invalid token" });
    (req as Request & { agentWallet?: string }).agentWallet = payload.walletAddress;
    return true;
  }
}

import type { AgentTokenPayload } from "./agent.types";

export abstract class AgentAuthPort {
  abstract createChallenge(address: string): Promise<string>;
  abstract verifySignature(
    address: string,
    challenge: string,
    signature: string,
  ): Promise<boolean>;
  abstract createToken(walletAddress: string): string;
  abstract validateToken(token: string): AgentTokenPayload | null;
}

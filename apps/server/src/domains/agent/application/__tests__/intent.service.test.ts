import { describe, expect, test } from "vitest";
import { Observable, of } from "rxjs";
import { IntentService } from "../intent.service";
import { AgentLLMPort } from "../../domain/agent-llm.port";
import type { AgentSSEEvent } from "../../domain/agent.types";

function mockLlm(events: AgentSSEEvent[]): AgentLLMPort {
  return {
    chat: () => of(...events) as Observable<AgentSSEEvent>,
  } as unknown as AgentLLMPort;
}

describe("IntentService", () => {
  test("parses well-formed JSON LLM output", async () => {
    const llm = mockLlm([
      { event: "typing" },
      { event: "stream", data: { delta: '{"symbol":"ETH","amount":"1","horizon":"mid","preferences":[]}' } },
      { event: "done", data: { sessionId: "s" } },
    ]);
    const svc = new IntentService(llm);
    const r = await svc.parse("1 ETH for 6 months", 8453);
    expect(r.asset.symbol).toBe("ETH");
    expect(r.amount).toBe("1");
    expect(r.horizon).toBe("mid");
  });

  test("falls back to heuristic on error event", async () => {
    const llm = mockLlm([
      { event: "typing" },
      { event: "error", data: { code: "ACPX_SPAWN", message: "missing acpx" } },
      { event: "done", data: { sessionId: "s" } },
    ]);
    const svc = new IntentService(llm);
    const r = await svc.parse("$3,000 USDC for 6 months", 8453);
    expect(r.asset.symbol).toBe("USDC");
    expect(r.amount).toBe("3000");
    expect(r.horizon).toBe("mid");
  });

  test("falls back to heuristic on non-JSON output", async () => {
    const llm = mockLlm([
      { event: "stream", data: { delta: "I don't know" } },
      { event: "done", data: { sessionId: "s" } },
    ]);
    const svc = new IntentService(llm);
    const r = await svc.parse("$10k USDT 3 years", 8453);
    expect(r.asset.symbol).toBe("USDT");
    expect(r.amount).toBe("10000");
    expect(r.horizon).toBe("long");
  });
});

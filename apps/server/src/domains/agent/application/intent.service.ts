import { Injectable, Logger } from "@nestjs/common";
import { firstValueFrom, lastValueFrom } from "rxjs";
import { defaultIfEmpty, toArray } from "rxjs/operators";
import { DEFAULT_CHAIN_ID, ParsedIntentSchema, type ParsedIntent } from "@seabw/core";
import { AgentLLMPort } from "../domain/agent-llm.port";
import { parseIntentHeuristic } from "../../plan/internal/heuristic-intent";
import type { AgentSSEEvent } from "../domain/agent.types";

const SYSTEM_PROMPT = [
  "You are an intent parser for seabw, a DeFi robo-advisor.",
  "Convert a user's free-text goal into a strict JSON object with EXACTLY these fields and NO others:",
  '{ "symbol": string, "amount": string, "horizon": "short"|"mid"|"long"|"", "preferences": string[] }',
  "Output ONLY the JSON object — no prose, no code fences. Leave fields empty if unspecified. Do not invent amounts.",
].join("\n");

@Injectable()
export class IntentService {
  private readonly logger = new Logger(IntentService.name);

  constructor(private readonly llm: AgentLLMPort) {}

  async parse(rawText: string, chainId = DEFAULT_CHAIN_ID, signal?: AbortSignal): Promise<ParsedIntent> {
    try {
      const events = await firstValueFrom(
        this.llm
          .chat({
            systemPrompt: SYSTEM_PROMPT,
            messages: [{ role: "user", content: rawText }],
            context: { sessionKey: `intent-${Date.now()}` },
          })
          .pipe(toArray(), defaultIfEmpty([] as AgentSSEEvent[])),
      );
      if (signal?.aborted) throw new Error("aborted");

      let buffer = "";
      let errored: string | null = null;
      for (const ev of events) {
        if (ev.event === "stream") buffer += ev.data.delta;
        if (ev.event === "error") errored = ev.data.message;
      }
      if (errored) throw new Error(errored);

      const json = extractJsonBlock(buffer);
      if (!json) throw new Error("no JSON in LLM output");
      const parsed = JSON.parse(json) as {
        symbol?: string;
        amount?: string;
        horizon?: string;
        preferences?: string[];
      };
      const fallback = parseIntentHeuristic(rawText, chainId);
      return ParsedIntentSchema.parse({
        asset: {
          symbol: (parsed.symbol || fallback.asset.symbol).toUpperCase(),
          chainId,
        },
        amount: parsed.amount || fallback.amount,
        horizon: (parsed.horizon || fallback.horizon || undefined) as ParsedIntent["horizon"],
        preferences:
          parsed.preferences && parsed.preferences.length > 0
            ? parsed.preferences
            : fallback.preferences,
        rawText,
      });
    } catch (err) {
      this.logger.warn(`intent codex failed → heuristic fallback: ${(err as Error).message}`);
      return parseIntentHeuristic(rawText, chainId);
    }
  }
}

function extractJsonBlock(text: string): string | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  return text.slice(first, last + 1);
}

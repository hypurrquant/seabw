import Anthropic from "@anthropic-ai/sdk";
import type { ParsedIntent } from "@/types";
import { ParsedIntentSchema } from "@/schemas";
import { DEFAULT_CHAIN_ID } from "@/config/chains";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are an intent parser for DefiPilot, a DeFi robo-advisor.
You convert free-text user goals into a strict JSON intent. Do not invent amounts.
If amount or asset is missing, leave fields empty strings. Be conservative.`;

const TOOL = {
  name: "emit_parsed_intent",
  description: "Emit a parsed intent for a DeFi capital-allocation goal.",
  input_schema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Asset ticker, e.g. USDC, ETH, WBTC. Empty if unspecified." },
      amount: { type: "string", description: "Decimal string in human units, e.g. '3000'. Empty if unspecified." },
      horizon: { type: "string", enum: ["short", "mid", "long", ""], description: "Time horizon." },
      preferences: {
        type: "array",
        items: { type: "string" },
        description: "Tags like 'no-bridge', 'stable-only', 'auto-compound'.",
      },
    },
    required: ["symbol", "amount", "horizon", "preferences"],
    additionalProperties: false,
  },
} as const;

const AMOUNT_RE = /\$?\s*([0-9][\d,]*(?:\.\d+)?)\s*(k|m)?/i;
const SYMBOL_RE = /\b(USDC|USDT|DAI|USDS|FRAX|ETH|WETH|BTC|WBTC|cbBTC|cbETH|SOL|MATIC|ARB|OP)\b/i;
const HORIZON_RULES: { regex: RegExp; value: "short" | "mid" | "long" }[] = [
  { regex: /\b(weeks?|few days|short[- ]?term|quick)\b/i, value: "short" },
  { regex: /\b(2 ?years?|3 ?years?|long[- ]?term|forever|hodl|hold)\b/i, value: "long" },
  { regex: /\b(months?|6 ?mo|half[- ]?year|years?)\b/i, value: "mid" },
];

function normalizeAmount(raw: string, suffix?: string): string {
  const stripped = raw.replace(/,/g, "");
  const n = parseFloat(stripped);
  if (!Number.isFinite(n)) return "0";
  const scaled = suffix?.toLowerCase() === "k" ? n * 1_000 : suffix?.toLowerCase() === "m" ? n * 1_000_000 : n;
  return Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(2);
}

export function parseIntentHeuristic(rawText: string, chainId = DEFAULT_CHAIN_ID): ParsedIntent {
  const symbolMatch = rawText.match(SYMBOL_RE);
  const symbol = (symbolMatch?.[1] ?? "USDC").toUpperCase();
  const amountMatch = rawText.match(AMOUNT_RE);
  const amount = amountMatch ? normalizeAmount(amountMatch[1], amountMatch[2]) : "0";
  let horizon: ParsedIntent["horizon"];
  for (const rule of HORIZON_RULES) {
    if (rule.regex.test(rawText)) {
      horizon = rule.value;
      break;
    }
  }
  const preferences: string[] = [];
  if (/no[- ]?bridge/i.test(rawText)) preferences.push("no-bridge");
  if (/stable[- ]?only|no[- ]?volatile/i.test(rawText)) preferences.push("stable-only");
  if (/auto[- ]?compound/i.test(rawText)) preferences.push("auto-compound");
  return ParsedIntentSchema.parse({
    asset: { symbol, chainId },
    amount,
    horizon,
    preferences: preferences.length > 0 ? preferences : undefined,
    rawText,
  });
}

export async function parseIntentLlm(
  rawText: string,
  chainId = DEFAULT_CHAIN_ID,
  signal?: AbortSignal,
): Promise<ParsedIntent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: rawText }],
    },
    signal ? { signal } : undefined,
  );
  const toolUse = res.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("LLM did not call the emit_parsed_intent tool");
  }
  const input = toolUse.input as {
    symbol: string;
    amount: string;
    horizon: string;
    preferences: string[];
  };
  const fallbackHeuristic = parseIntentHeuristic(rawText, chainId);
  return ParsedIntentSchema.parse({
    asset: {
      symbol: (input.symbol || fallbackHeuristic.asset.symbol).toUpperCase(),
      chainId,
    },
    amount: input.amount || fallbackHeuristic.amount,
    horizon: (input.horizon || fallbackHeuristic.horizon || undefined) as ParsedIntent["horizon"],
    preferences:
      input.preferences && input.preferences.length > 0 ? input.preferences : fallbackHeuristic.preferences,
    rawText,
  });
}

export async function parseIntent(
  rawText: string,
  chainId = DEFAULT_CHAIN_ID,
  signal?: AbortSignal,
): Promise<ParsedIntent> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await parseIntentLlm(rawText, chainId, signal);
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
      console.warn("[intent] LLM parse failed, using heuristic:", (err as Error).message);
    }
  }
  return parseIntentHeuristic(rawText, chainId);
}

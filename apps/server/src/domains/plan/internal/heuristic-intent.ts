import { DEFAULT_CHAIN_ID, type ParsedIntent, ParsedIntentSchema } from "@seabw/core";

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
  const scaled =
    suffix?.toLowerCase() === "k"
      ? n * 1_000
      : suffix?.toLowerCase() === "m"
        ? n * 1_000_000
        : n;
  return Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(2);
}

export function parseIntentHeuristic(
  rawText: string,
  chainId = DEFAULT_CHAIN_ID,
): ParsedIntent {
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

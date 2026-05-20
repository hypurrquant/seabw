import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AnswerScoreSchema, TierSchema } from "@/schemas";
import { composeBasketPlan } from "@/agent/basket-composer";
import { evaluatePlan } from "@/policy/guardrails";
import { rateLimit } from "@/lib/ratelimit";
import { anonId, logPlanRequest } from "@/lib/auditLog";
import { priceMap, usdPrice } from "@/lib/prices";
import { CHAINS } from "@/config/chains";
import { rememberPlan } from "@/lib/planStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HexAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

const ReqSchema = z.object({
  tier: TierSchema,
  rawScore: z.number().int().min(5).max(32),
  literacyScore: AnswerScoreSchema,
  derivativeExpScore: AnswerScoreSchema,
  vulnerableConsumer: z.boolean(),
  basket: z
    .array(
      z.object({
        productId: z.string().min(1),
        amountUsd: z.number().nonnegative().max(1_000_000),
        diversifyAcross: z.number().int().min(1).max(3).optional(),
        splitRanges: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(8),
  wallet: z.object({
    address: HexAddress,
    chainId: z.number().int().positive(),
    gasBalanceWei: z.string(),
  }),
});

const AGENT_TIMEOUT_MS = 30_000;

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();
  const ip = clientIp(req);
  const rate = rateLimit(`basket-plan:${ip}`, 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many plan requests" }, { status: 429 });
  }
  if (process.env.DEFIPILOT_DISABLE_EXEC === "true") {
    return NextResponse.json({ error: "Execution disabled" }, { status: 503 });
  }
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid basket request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const env: "demo" | "prod" =
    (process.env.DEFIPILOT_ENV ?? "demo") === "prod" ? "prod" : "demo";

  const controller = new AbortController();
  const budgetTimer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
  try {
    const intentText = `basket of ${input.basket.length} positions`;
    const draft = await withTimeout(
      composeBasketPlan(input.basket, {
        tier: input.tier,
        intentRawText: intentText,
        fromAddress: input.wallet.address,
        env,
      }),
      AGENT_TIMEOUT_MS,
      "composeBasketPlan",
    );
    const symbols = draft.steps.flatMap((s) =>
      s.expected.inputs.concat(s.expected.outputs).map((t) => t.token),
    );
    const prices = await withTimeout(
      priceMap(symbols, input.wallet.chainId, controller.signal),
      AGENT_TIMEOUT_MS,
      "priceMap",
    );
    const nativeSymbol = CHAINS[input.wallet.chainId]?.nativeSymbol ?? "ETH";
    const nativeUsdPrice = await withTimeout(
      usdPrice(nativeSymbol, input.wallet.chainId, controller.signal),
      AGENT_TIMEOUT_MS,
      "usdPrice",
    );
    const result = evaluatePlan(draft, {
      tier: input.tier,
      rawScore: input.rawScore,
      literacyScore: input.literacyScore,
      derivativeExpScore: input.derivativeExpScore,
      vulnerableConsumer: input.vulnerableConsumer,
      signerAddress: input.wallet.address,
      signTimestampMs: Date.now(),
      gasBalanceWei: BigInt(input.wallet.gasBalanceWei),
      nativeUsdPrice,
      firstRun: true,
      env,
      usdPrices: prices,
    });
    if (!result.ok) {
      logPlanRequest({
        ts: new Date().toISOString(),
        anonId: anonId(ip, input.wallet.address),
        tier: input.tier,
        intentLen: intentText.length,
        appliedRules: [],
        rejectedRuleId: result.ruleId,
        durationMs: Date.now() - start,
        ok: false,
      });
      clearTimeout(budgetTimer);
      return NextResponse.json(
        { error: result.reason, ruleId: result.ruleId },
        { status: 422 },
      );
    }
    rememberPlan(result.plan, input.wallet.address);
    logPlanRequest({
      ts: new Date().toISOString(),
      anonId: anonId(ip, input.wallet.address),
      tier: input.tier,
      intentLen: intentText.length,
      appliedRules: result.plan.guardrails.appliedRules,
      durationMs: Date.now() - start,
      ok: true,
    });
    clearTimeout(budgetTimer);
    return NextResponse.json({ plan: result.plan });
  } catch (err) {
    clearTimeout(budgetTimer);
    controller.abort();
    return NextResponse.json(
      { error: `Couldn't build basket plan: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}

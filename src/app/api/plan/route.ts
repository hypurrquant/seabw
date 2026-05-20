import { NextRequest, NextResponse } from "next/server";
import { PlanRequestSchema } from "@/schemas";
import { parseIntent } from "@/agent/intent";
import { composePlan } from "@/agent/composer";
import { evaluatePlan } from "@/policy/guardrails";
import { rateLimit } from "@/lib/ratelimit";
import { anonId, logPlanRequest } from "@/lib/auditLog";
import { priceMap, usdPrice } from "@/lib/prices";
import { CHAINS } from "@/config/chains";
import { rememberPlan } from "@/lib/planStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGENT_TIMEOUT_MS = 30_000;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();
  const ip = clientIp(req);
  const rate = rateLimit(`plan:${ip}`, 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many plan requests. Please wait." },
      { status: 429, headers: { "retry-after": Math.ceil(rate.retryAfterMs / 1000).toString() } },
    );
  }

  if (process.env.DEFIPILOT_DISABLE_EXEC === "true") {
    return NextResponse.json(
      { error: "Execution is disabled by the operator. Try again later." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid plan request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const env: "demo" | "prod" =
    (process.env.DEFIPILOT_ENV ?? "demo") === "prod" ? "prod" : "demo";

  // §8.4 agent.timeout — single 30s wall-clock budget covering all phases.
  const controller = new AbortController();
  const budgetTimer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

  try {
    const budgetGuard = <T,>(p: Promise<T>): Promise<T> =>
      withTimeout(p, AGENT_TIMEOUT_MS, "agent.timeout");
    const intent = await budgetGuard(
      parseIntent(input.intentText, input.wallet.chainId, controller.signal),
    );
    const draft = await budgetGuard(
      composePlan(input.tier, intent, {
        fromAddress: input.wallet.address,
        env,
        signal: controller.signal,
      }),
    );
    const allSymbols = draft.steps.flatMap((s) =>
      s.expected.inputs.concat(s.expected.outputs).map((t) => t.token),
    );
    const prices = await budgetGuard(
      priceMap(allSymbols, input.wallet.chainId, controller.signal),
    );
    const nativeSymbol = CHAINS[input.wallet.chainId]?.nativeSymbol ?? "ETH";
    const nativeUsdPrice = await budgetGuard(
      usdPrice(nativeSymbol, input.wallet.chainId, controller.signal),
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
        intentLen: input.intentText.length,
        appliedRules: [],
        rejectedRuleId: result.ruleId,
        durationMs: Date.now() - start,
        ok: false,
      });
      return NextResponse.json(
        { error: result.reason, ruleId: result.ruleId },
        { status: 422 },
      );
    }

    logPlanRequest({
      ts: new Date().toISOString(),
      anonId: anonId(ip, input.wallet.address),
      tier: input.tier,
      intentLen: input.intentText.length,
      appliedRules: result.plan.guardrails.appliedRules,
      durationMs: Date.now() - start,
      ok: true,
    });

    // §8.6 — server keeps the canonical plan so /api/precheck can revalidate
    // without trusting client-supplied metadata.
    rememberPlan(result.plan, input.wallet.address);

    clearTimeout(budgetTimer);
    return NextResponse.json({ plan: result.plan });
  } catch (err) {
    clearTimeout(budgetTimer);
    controller.abort();
    const message = (err as Error).message ?? "Unknown error";
    logPlanRequest({
      ts: new Date().toISOString(),
      anonId: anonId(ip, input.wallet.address),
      tier: input.tier,
      intentLen: input.intentText.length,
      appliedRules: [],
      rejectedRuleId: "agent.error",
      durationMs: Date.now() - start,
      ok: false,
    });
    return NextResponse.json(
      { error: `We couldn't build a safe plan for that. ${message}` },
      { status: 500 },
    );
  }
}

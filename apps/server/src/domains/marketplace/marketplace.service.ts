import { Injectable } from "@nestjs/common";
import {
  CHAINS,
  type PipelinePlan,
  type Tier,
  type YieldProduct,
} from "@seabw/core";
import { composeBasketPlan } from "./internal/basket-composer";
import { liveCatalogForTier } from "./internal/yields";
import { evaluatePlan } from "../plan/internal/guardrails";
import { rememberPlan } from "../plan/internal/plan-store";
import { anonId, logPlanRequest } from "../plan/internal/audit-log";
import { priceMap, usdPrice } from "../plan/internal/prices";
import type { MarketplacePlanRequest } from "@seabw/core";

const AGENT_TIMEOUT_MS = 30_000;

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

@Injectable()
export class MarketplaceService {
  async listYields(tier: Tier): Promise<{ tier: Tier; count: number; products: YieldProduct[] }> {
    const catalog = await liveCatalogForTier(tier);
    return { tier, count: catalog.length, products: catalog };
  }

  async composeBasket(input: MarketplacePlanRequest, ip: string): Promise<{ status: number; body: unknown }> {
    const start = Date.now();
    const env: "demo" | "prod" =
      (process.env.DEFIPILOT_ENV ?? "demo") === "prod" ? "prod" : "demo";
    const controller = new AbortController();
    const budgetTimer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
    try {
      const intentText = `basket of ${input.basket.length} positions`;
      const draft: PipelinePlan = await withTimeout(
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
        return { status: 422, body: { error: result.reason, ruleId: result.ruleId } };
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
      return { status: 200, body: { plan: result.plan } };
    } catch (err) {
      const message = (err as Error).message ?? "Unknown error";
      return {
        status: 500,
        body: { error: `Couldn't build basket plan: ${message}` },
      };
    } finally {
      clearTimeout(budgetTimer);
      controller.abort();
    }
  }
}

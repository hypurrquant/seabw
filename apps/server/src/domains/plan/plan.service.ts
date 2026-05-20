import { Injectable, Logger } from "@nestjs/common";
import {
  CHAINS,
  type ParsedIntent,
  type PipelinePlan,
  type PlanRequest,
} from "@seabw/core";
import { composePlan, tryHydrateCalldata } from "./internal/composer";
import { evaluatePlan } from "./internal/guardrails";
import { anonId, logPlanRequest } from "./internal/audit-log";
import { priceMap, usdPrice } from "./internal/prices";
import { rememberPlan, recallPlan } from "./internal/plan-store";
import { isFixtureMode } from "../../lib/defi-cli";
import { isSanctioned } from "../precheck/internal/sanctions";
import { parseIntentHeuristic } from "./internal/heuristic-intent";
import { IntentService } from "../agent/application/intent.service";

const AGENT_TIMEOUT_MS = 30_000;
const HYDRATABLE_KINDS = new Set(["lend.supply", "swap", "lp.add", "lp.stake"]);

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

export interface ComposeResult {
  kind: "ok" | "rejected";
  status: number;
  body: unknown;
}

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(private readonly intent: IntentService) {}

  parseIntentText(rawText: string, chainId: number): ParsedIntent {
    return parseIntentHeuristic(rawText, chainId);
  }

  async composeForRequest(input: PlanRequest, ip: string): Promise<ComposeResult> {
    const start = Date.now();
    const env: "demo" | "prod" =
      (process.env.DEFIPILOT_ENV ?? "demo") === "prod" ? "prod" : "demo";
    const controller = new AbortController();
    const budgetTimer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
    const guard = <T>(p: Promise<T>): Promise<T> => withTimeout(p, AGENT_TIMEOUT_MS, "agent.timeout");

    try {
      const intent = await guard(
        this.intent.parse(input.intentText, input.wallet.chainId, controller.signal),
      );
      const draft = await guard(
        composePlan(input.tier, intent, {
          fromAddress: input.wallet.address,
          env,
          signal: controller.signal,
        }),
      );
      const allSymbols = draft.steps.flatMap((s) =>
        s.expected.inputs.concat(s.expected.outputs).map((t) => t.token),
      );
      const prices = await guard(priceMap(allSymbols, input.wallet.chainId, controller.signal));
      const nativeSymbol = CHAINS[input.wallet.chainId]?.nativeSymbol ?? "ETH";
      const nativeUsdPrice = await guard(
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
        return {
          kind: "rejected",
          status: 422,
          body: { error: result.reason, ruleId: result.ruleId },
        };
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

      rememberPlan(result.plan, input.wallet.address);
      return { kind: "ok", status: 200, body: { plan: result.plan } };
    } finally {
      clearTimeout(budgetTimer);
      controller.abort();
    }
  }

  async rehydrate(planId: string, signerAddress: `0x${string}`): Promise<ComposeResult> {
    if (isSanctioned(signerAddress)) {
      return {
        kind: "rejected",
        status: 403,
        body: { error: "Address is on a sanctions list; refusing to bind plan." },
      };
    }
    const entry = recallPlan(planId);
    if (!entry) {
      return {
        kind: "rejected",
        status: 410,
        body: { error: "Plan not found; rebuild from Plan Review first." },
      };
    }
    let rebuiltSteps = entry.plan.steps;
    const alreadyBound = entry.address === signerAddress.toLowerCase();
    if (!isFixtureMode() && !alreadyBound) {
      const unsupported = entry.plan.steps
        .filter((s) => !HYDRATABLE_KINDS.has(s.kind))
        .map((s) => `${s.id}(${s.kind})`);
      if (unsupported.length > 0) {
        return {
          kind: "rejected",
          status: 422,
          body: {
            error: `Plan contains step kinds not yet wired through defi-cli: ${unsupported.join(", ")}.`,
          },
        };
      }
      rebuiltSteps = await Promise.all(
        entry.plan.steps.map((s) => tryHydrateCalldata(s, signerAddress)),
      );
      const stale: string[] = [];
      for (let i = 0; i < rebuiltSteps.length; i++) {
        if (rebuiltSteps[i].calldata.data === entry.plan.steps[i].calldata.data) {
          stale.push(rebuiltSteps[i].id);
        }
      }
      if (stale.length > 0) {
        return {
          kind: "rejected",
          status: 502,
          body: {
            error: `defi-cli did not rebind step(s) ${stale.join(", ")} to your address; rebuild the plan or retry.`,
          },
        };
      }
    }
    const marker = `rehydrate:${signerAddress.slice(0, 6).toLowerCase()}…${signerAddress.slice(-4)}`;
    const refreshed: PipelinePlan = {
      ...entry.plan,
      steps: rebuiltSteps,
      createdAt: new Date().toISOString(),
      guardrails: {
        ...entry.plan.guardrails,
        appliedRules: entry.plan.guardrails.appliedRules.includes(marker)
          ? entry.plan.guardrails.appliedRules
          : [...entry.plan.guardrails.appliedRules, marker],
      },
    };
    rememberPlan(refreshed, signerAddress);
    return { kind: "ok", status: 200, body: { plan: refreshed } };
  }
}

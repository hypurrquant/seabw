import { Injectable } from "@nestjs/common";
import { recallPlan } from "../plan/internal/plan-store";
import { isSanctioned } from "./internal/sanctions";

const MAX_PLAN_AGE_MS = 5 * 60_000;

@Injectable()
export class PrecheckService {
  async run(planId: string, stepId: string, signerAddress: `0x${string}`): Promise<{ status: number; body: unknown }> {
    if (process.env.DEFIPILOT_DISABLE_EXEC === "true") {
      return {
        status: 503,
        body: {
          ok: false,
          ruleId: "ops.kill-switch",
          reason: "Execution is disabled by the operator.",
        },
      };
    }

    const entry = recallPlan(planId);
    if (!entry) {
      return {
        status: 410,
        body: {
          ok: false,
          ruleId: "calldata.revalidate",
          reason:
            "Plan not found on server (expired or never built here). Rebuild from Plan Review.",
        },
      };
    }
    if (entry.address !== signerAddress.toLowerCase()) {
      return {
        status: 403,
        body: {
          ok: false,
          ruleId: "agent.protocol.exists",
          reason: "Signer address does not match the plan's owning address.",
        },
      };
    }
    if (isSanctioned(entry.address)) {
      return {
        status: 403,
        body: {
          ok: false,
          ruleId: "ops.sanctioned.block",
          reason: "Address is on a sanctions list.",
        },
      };
    }
    const ageMs = Date.now() - new Date(entry.plan.createdAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs > MAX_PLAN_AGE_MS || ageMs < 0) {
      return {
        status: 422,
        body: {
          ok: false,
          ruleId: "calldata.revalidate",
          reason: `Plan is older than ${MAX_PLAN_AGE_MS / 60_000}min (${Math.round(ageMs / 1000)}s). Rebuild before signing.`,
        },
      };
    }
    const step = entry.plan.steps.find((s) => s.id === stepId);
    if (!step) {
      return {
        status: 404,
        body: {
          ok: false,
          ruleId: "agent.dry-run.mandatory",
          reason: `Step ${stepId} not in canonical plan.`,
        },
      };
    }
    if ((process.env.DEFIPILOT_ENV ?? "demo") === "prod" && step.calldata.data === "0x") {
      return {
        status: 422,
        body: {
          ok: false,
          ruleId: "agent.dry-run.mandatory",
          reason: "Step has placeholder calldata; defi-cli dry-run never produced real data.",
        },
      };
    }
    return {
      status: 200,
      body: {
        ok: true,
        appliedRules: [
          "ops.kill-switch",
          "ops.sanctioned.block",
          "calldata.revalidate",
          "agent.dry-run.mandatory",
        ],
        canonicalCalldata: step.calldata,
      },
    };
  }
}

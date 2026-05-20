import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSanctioned } from "@/policy/sanctions";
import { recallPlan } from "@/lib/planStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReqSchema = z.object({
  planId: z.string().min(1),
  stepId: z.string().min(1),
  signerAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/),
});

// §8.6 ops.kill-switch / §8.3 calldata.revalidate — server-side runtime check
// invoked before every sign. All authoritative state (plan, createdAt,
// address) is fetched from the in-memory plan store; the client cannot smuggle
// stale data past the gate.
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid precheck payload" }, { status: 400 });
  }
  const { planId, stepId, signerAddress } = parsed.data;

  if (process.env.DEFIPILOT_DISABLE_EXEC === "true") {
    return NextResponse.json(
      {
        ok: false,
        ruleId: "ops.kill-switch",
        reason: "Execution is disabled by the operator.",
      },
      { status: 503 },
    );
  }

  const entry = recallPlan(planId);
  if (!entry) {
    return NextResponse.json(
      {
        ok: false,
        ruleId: "calldata.revalidate",
        reason:
          "Plan not found on server (expired or never built here). Rebuild from Plan Review.",
      },
      { status: 410 },
    );
  }

  if (entry.address !== signerAddress.toLowerCase()) {
    return NextResponse.json(
      {
        ok: false,
        ruleId: "agent.protocol.exists",
        reason: "Signer address does not match the plan's owning address.",
      },
      { status: 403 },
    );
  }

  if (isSanctioned(entry.address)) {
    return NextResponse.json(
      {
        ok: false,
        ruleId: "ops.sanctioned.block",
        reason: "Address is on a sanctions list.",
      },
      { status: 403 },
    );
  }

  // Multi-step plans (lend.supply + swap + lp.add + lp.stake) realistically
  // take 1-3 minutes to sign once you factor in wallet confirmations and chain
  // switches. The previous 30s window timed users out mid-flight; 5 minutes is
  // tight enough that the canonical calldata is still mempool-fresh, loose
  // enough that the user isn't punished for using a hardware wallet.
  const MAX_PLAN_AGE_MS = 5 * 60_000;
  const ageMs = Date.now() - new Date(entry.plan.createdAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs > MAX_PLAN_AGE_MS || ageMs < 0) {
    return NextResponse.json(
      {
        ok: false,
        ruleId: "calldata.revalidate",
        reason: `Plan is older than ${MAX_PLAN_AGE_MS / 60_000}min (${Math.round(ageMs / 1000)}s). Rebuild before signing.`,
      },
      { status: 422 },
    );
  }

  const step = entry.plan.steps.find((s) => s.id === stepId);
  if (!step) {
    return NextResponse.json(
      {
        ok: false,
        ruleId: "agent.dry-run.mandatory",
        reason: `Step ${stepId} not in canonical plan.`,
      },
      { status: 404 },
    );
  }

  if (
    (process.env.DEFIPILOT_ENV ?? "demo") === "prod" &&
    step.calldata.data === "0x"
  ) {
    return NextResponse.json(
      {
        ok: false,
        ruleId: "agent.dry-run.mandatory",
        reason: "Step has placeholder calldata; defi-cli dry-run never produced real data.",
      },
      { status: 422 },
    );
  }
  // Defense against preview-bound plans reaching this endpoint without going
  // through /api/plan/rehydrate: the bound address would still be the burn
  // placeholder, and signer-match (line 58 above) already rejects on that.
  // We deliberately do NOT pattern-match on calldata bytes here — heuristic
  // substring checks have false-positive surface on ABI-padded small ints.

  return NextResponse.json({
    ok: true,
    appliedRules: [
      "ops.kill-switch",
      "ops.sanctioned.block",
      "calldata.revalidate",
      "agent.dry-run.mandatory",
    ],
    canonicalCalldata: step.calldata,
  });
}

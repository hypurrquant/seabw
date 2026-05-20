import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recallPlan, rememberPlan } from "@/lib/planStore";
import { tryHydrateCalldata } from "@/agent/composer";
import { isFixtureMode } from "@/lib/defiCli";
import { isSanctioned } from "@/policy/sanctions";
import { PipelinePlanSchema } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReqSchema = z.object({
  planId: z.string().min(1),
  signerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

// Plans are built first against a burn placeholder so users can preview the
// full pipeline without connecting a wallet. When they decide to sign, the
// client calls this endpoint with the real signerAddress; we re-run defi-cli
// hydration for every step so calldata recipients are bound to the actual
// wallet, refresh createdAt (so the precheck drift check restarts), and store
// the canonical plan back to planStore for /api/precheck.
//
// Step kinds that tryHydrateCalldata actively re-hydrates against the signer.
// Other kinds (e.g. lend.withdraw) are not yet wired and would always look
// "unchanged" to the structural canary, so we exempt them.
const HYDRATABLE_KINDS = new Set(["lend.supply", "swap", "lp.add", "lp.stake"]);
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid rehydrate payload" },
      { status: 400 },
    );
  }
  const { planId, signerAddress } = parsed.data;

  if (process.env.DEFIPILOT_DISABLE_EXEC === "true") {
    return NextResponse.json(
      { error: "Execution disabled" },
      { status: 503 },
    );
  }

  if (isSanctioned(signerAddress)) {
    return NextResponse.json(
      { error: "Address is on a sanctions list; refusing to bind plan." },
      { status: 403 },
    );
  }

  const entry = recallPlan(planId);
  if (!entry) {
    return NextResponse.json(
      { error: "Plan not found; rebuild from Plan Review first." },
      { status: 410 },
    );
  }

  let rebuiltSteps = entry.plan.steps;
  // Skip the defi-cli round-trip when the bound address already matches —
  // this turns rehydrate into a cheap freshness-window restart for users who
  // were connected at plan-build time.
  const alreadyBound = entry.address === signerAddress.toLowerCase();
  if (!isFixtureMode() && !alreadyBound) {
    // Fail BEFORE spawning defi-cli: if any step kind has no hydration branch
    // (e.g. lend.withdraw in degen plans), exempting it from the structural
    // check would silently bind preview-owner calldata. Refuse the rehydrate
    // and surface the gap so the kind gets wired before signing.
    const unsupported = entry.plan.steps
      .filter((s) => !HYDRATABLE_KINDS.has(s.kind))
      .map((s) => `${s.id}(${s.kind})`);
    if (unsupported.length > 0) {
      return NextResponse.json(
        {
          error: `Plan contains step kinds not yet wired through defi-cli: ${unsupported.join(", ")}. Cannot rebind to your address in live mode.`,
        },
        { status: 422 },
      );
    }

    rebuiltSteps = await Promise.all(
      entry.plan.steps.map((s) => tryHydrateCalldata(s, signerAddress)),
    );

    // Structural fail-closed: every hydratable step kind embeds the signer
    // (--on-behalf-of for lend.supply, --recipient for lp.add/lp.stake,
    // DEFI_WALLET_ADDRESS for LI.FI swap quotes), so a rehydrate against a
    // different signer MUST change calldata bytes. Equality after ⇔ defi-cli
    // silently dropped the call (threw + catch swallowed, or an early-return
    // like missing chainKey fired) and signing it would route funds to the
    // preview owner.
    const stale: string[] = [];
    for (let i = 0; i < rebuiltSteps.length; i++) {
      if (rebuiltSteps[i].calldata.data === entry.plan.steps[i].calldata.data) {
        stale.push(rebuiltSteps[i].id);
      }
    }
    if (stale.length > 0) {
      return NextResponse.json(
        {
          error: `defi-cli did not rebind step(s) ${stale.join(", ")} to your address; rebuild the plan or retry.`,
        },
        { status: 502 },
      );
    }
  }

  const rehydrateMarker = `rehydrate:${signerAddress.slice(0, 6).toLowerCase()}…${signerAddress.slice(-4)}`;
  const refreshed = {
    ...entry.plan,
    steps: rebuiltSteps,
    createdAt: new Date().toISOString(),
    guardrails: {
      ...entry.plan.guardrails,
      appliedRules: entry.plan.guardrails.appliedRules.includes(rehydrateMarker)
        ? entry.plan.guardrails.appliedRules
        : [...entry.plan.guardrails.appliedRules, rehydrateMarker],
    },
  };
  const validated = PipelinePlanSchema.parse(refreshed);
  rememberPlan(validated, signerAddress);
  return NextResponse.json({ plan: validated });
}

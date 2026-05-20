import { test } from "vitest";
import assert from "node:assert/strict";
import type { PipelinePlan, PlanStep, Tier } from "@seabw/core";
import { evaluatePlan, type GuardrailContext } from "../guardrails";

const NOW = Math.floor(Date.now() / 1000);
const DEADLINE = NOW + 10 * 60;

function ctx(tier: Tier, overrides: Partial<GuardrailContext> = {}): GuardrailContext {
  return {
    tier,
    rawScore: 22,
    literacyScore: 4,
    derivativeExpScore: 4,
    vulnerableConsumer: false,
    signerAddress: "0x000000000000000000000000000000000000abcd",
    signTimestampMs: Date.now(),
    gasBalanceWei: 1_000_000_000_000_000n,
    firstRun: false,
    env: "demo",
    ...overrides,
  };
}

function plan(tier: Tier, steps: PlanStep[]): PipelinePlan {
  return {
    planId: "plan_test",
    tier,
    intent: {
      asset: { symbol: "USDC", chainId: 8453 },
      amount: "3000",
      rawText: "test",
    },
    steps,
    aggregate: { estimatedAprPct: 20, estimatedGasUsd: 1, riskFlags: [] },
    guardrails: { appliedRules: ["draft"] },
    createdAt: new Date().toISOString(),
  };
}

const supplyStep: PlanStep = {
  id: "s1",
  kind: "lend.supply",
  chainId: 8453,
  protocol: "aave-v3-base",
  params: { token: "USDC", amount: "3000", deadline: DEADLINE },
  expected: {
    inputs: [{ token: "USDC", amount: "3000" }],
    outputs: [{ token: "aUSDC", amount: "3000" }],
    feeUsd: 0.4,
    slippagePct: 0,
    aprPct: 5.2,
  },
  risks: [],
  calldata: { to: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", data: "0xab", value: "0" },
};

const swapStep: PlanStep = {
  id: "s2",
  kind: "swap",
  chainId: 8453,
  protocol: "uniswap-v3-base",
  params: { tokenIn: "USDC", tokenOut: "ETH", amountIn: "1500", deadline: DEADLINE },
  expected: {
    inputs: [{ token: "USDC", amount: "1500" }],
    outputs: [{ token: "ETH", amount: "0.46" }],
    feeUsd: 0.8,
    slippagePct: 0.4,
  },
  risks: [],
  calldata: { to: "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5", data: "0xcd", value: "0" },
};

const lpStep: PlanStep = {
  id: "s3",
  kind: "lp.add",
  chainId: 8453,
  protocol: "aerodrome-base",
  params: { pair: "ETH/USDC", deadline: DEADLINE },
  expected: {
    inputs: [
      { token: "ETH", amount: "0.46" },
      { token: "USDC", amount: "1500" },
    ],
    outputs: [{ token: "ETH/USDC LP", amount: "1" }],
    feeUsd: 0.6,
    slippagePct: 0.3,
    aprPct: 22.3,
  },
  risks: ["IL"],
  calldata: { to: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43", data: "0xef", value: "0" },
};

test("PASS: conservative stablecoin supply", () => {
  const r = evaluatePlan(plan("conservative", [supplyStep]), ctx("conservative", { literacyScore: 2 }));
  assert.equal(r.ok, true);
  if (r.ok) assert.ok(r.plan.guardrails.appliedRules.length > 1);
});

test("PASS: balanced LP plan", () => {
  const r = evaluatePlan(plan("balanced", [swapStep, lpStep]), ctx("balanced"));
  assert.equal(r.ok, true);
});

test("PASS: aggressive LP plan with emissions farm", () => {
  const r = evaluatePlan(plan("aggressive", [swapStep, lpStep]), ctx("aggressive"));
  assert.equal(r.ok, true);
});

test("REJECT: conservative plan holding ETH (volatile)", () => {
  const volatile: PlanStep = {
    ...lpStep,
    id: "v",
    protocol: "aave-v3-base",
    kind: "lend.supply",
    expected: { ...lpStep.expected, inputs: [{ token: "ETH", amount: "1" }], outputs: [] },
  };
  const r = evaluatePlan(plan("conservative", [volatile]), ctx("conservative", { literacyScore: 2 }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.ruleId, /tier\.cap\.volatile/);
});

test("REJECT: balanced plan with non-whitelisted protocol (gearbox is leverage)", () => {
  const bad: PlanStep = { ...lpStep, id: "x", protocol: "gearbox", chainId: 1 };
  const r = evaluatePlan(plan("balanced", [bad]), ctx("balanced"));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.ruleId, /agent\.protocol\.exists|tier\.bridge|tier\.cap\.leverage/);
});

test("REJECT: degen plan with literacyScore < 4", () => {
  const r = evaluatePlan(plan("degen", [supplyStep]), ctx("degen", { literacyScore: 3 }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.ruleId, "survey.literacy.gate");
});

test("REJECT: slippage above stable cap", () => {
  const bad: PlanStep = { ...swapStep, expected: { ...swapStep.expected, slippagePct: 0.7, inputs: [{ token: "USDC", amount: "1000" }], outputs: [{ token: "USDT", amount: "1000" }] } };
  const r = evaluatePlan(plan("balanced", [bad]), ctx("balanced"));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.ruleId, /slippage/);
});

test("REJECT: too many steps", () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ ...supplyStep, id: `s${i}` }));
  const r = evaluatePlan(plan("balanced", many), ctx("balanced"));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.ruleId, "agent.steps.max");
});

// --- LP cap with tagged capital (basket plans) -----------------------------

function lendingTaggedStep(id: string, capitalUsd: number): PlanStep {
  return {
    id,
    kind: "lend.supply",
    chainId: 8453,
    protocol: "aave-v3-base",
    params: {
      token: "USDC",
      amount: String(capitalUsd),
      deadline: DEADLINE,
      _capitalRole: "lend",
      _capitalUsd: capitalUsd,
    },
    expected: {
      inputs: [{ token: "USDC", amount: String(capitalUsd) }],
      outputs: [{ token: "aUSDC", amount: String(capitalUsd) }],
      feeUsd: 0.4,
      slippagePct: 0,
      aprPct: 5.2,
    },
    risks: [],
    calldata: {
      to: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
      data: "0xab",
      value: "0",
    },
  };
}

function lpTaggedSteps(idBase: string, capitalUsd: number): PlanStep[] {
  const half = capitalUsd / 2;
  return [
    {
      id: `${idBase}_swap`,
      kind: "swap",
      chainId: 8453,
      protocol: "aerodrome-base",
      params: {
        tokenIn: "USDC",
        tokenOut: "ETH",
        amountIn: String(half),
        deadline: DEADLINE,
        _capitalRole: "lp-prep",
        _capitalUsd: half,
      },
      expected: {
        inputs: [{ token: "USDC", amount: String(half) }],
        outputs: [{ token: "ETH", amount: (half / 3200).toFixed(6) }],
        feeUsd: 0.5,
        slippagePct: 0.4,
      },
      risks: [],
      calldata: {
        to: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
        data: "0xcd",
        value: "0",
      },
    },
    {
      id: `${idBase}_lp`,
      kind: "lp.add",
      chainId: 8453,
      protocol: "aerodrome-base",
      params: {
        pair: "ETH/USDC",
        deadline: DEADLINE,
        _capitalRole: "lp",
        _capitalUsd: half,
      },
      expected: {
        inputs: [
          { token: "ETH", amount: (half / 3200).toFixed(6) },
          { token: "USDC", amount: String(half) },
        ],
        outputs: [{ token: "ETH/USDC LP", amount: "1" }],
        feeUsd: 0.6,
        slippagePct: 0.3,
        aprPct: 22,
      },
      risks: ["IL"],
      calldata: {
        to: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
        data: "0xef",
        value: "0",
      },
    },
  ];
}

test("PASS: tagged basket lending 60% + LP 40% on Balanced", () => {
  const steps = [lendingTaggedStep("lend1", 1800), ...lpTaggedSteps("lp1", 1200)];
  const r = evaluatePlan(plan("balanced", steps), ctx("balanced"));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.ok(
      r.plan.guardrails.appliedRules.some((x) => x.startsWith("tier.cap.lp@60%:tagged")),
      "should use tagged accounting",
    );
  }
});

test("PASS: tagged basket exactly 60% LP on Balanced (cap boundary)", () => {
  const steps = [lendingTaggedStep("lend1", 1200), ...lpTaggedSteps("lp1", 1800)];
  const r = evaluatePlan(plan("balanced", steps), ctx("balanced"));
  assert.equal(r.ok, true);
});

test("REJECT: pure-LP basket on Balanced (real semantic gap)", () => {
  const steps = [...lpTaggedSteps("lp1", 1800), ...lpTaggedSteps("lp2", 1200)];
  const r = evaluatePlan(plan("balanced", steps), ctx("balanced"));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.ruleId, "tier.cap.lp");
});

test("PASS: untagged intent-built plan uses fresh-input fallback", () => {
  const r = evaluatePlan(plan("balanced", [swapStep, lpStep]), ctx("balanced"));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.ok(
      r.plan.guardrails.appliedRules.some((x) => x.startsWith("tier.cap.lp@60%:fresh")),
      "should fall back to fresh-input math when tags are absent",
    );
  }
});

// ---------------- tier.cap.single-pool (A guardrail) ----------------

function lpTaggedStepOnPool(idBase: string, protocol: string, capitalUsd: number): PlanStep[] {
  const half = capitalUsd / 2;
  return [
    {
      id: `${idBase}_swap`,
      kind: "swap",
      chainId: 8453,
      protocol,
      params: {
        tokenIn: "USDC",
        tokenOut: "ETH",
        amountIn: String(half),
        deadline: DEADLINE,
        _capitalRole: "lp-prep",
        _capitalUsd: half,
      },
      expected: {
        inputs: [{ token: "USDC", amount: String(half) }],
        outputs: [{ token: "ETH", amount: (half / 3200).toFixed(6) }],
        feeUsd: 0.5,
        slippagePct: 0.4,
      },
      risks: [],
      calldata: {
        to: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
        data: "0xcd",
        value: "0",
      },
    },
    {
      id: `${idBase}_lp`,
      kind: "lp.add",
      chainId: 8453,
      protocol,
      params: {
        pair: "ETH/USDC",
        deadline: DEADLINE,
        _capitalRole: "lp",
        _capitalUsd: half,
      },
      expected: {
        inputs: [
          { token: "ETH", amount: (half / 3200).toFixed(6) },
          { token: "USDC", amount: String(half) },
        ],
        outputs: [{ token: "ETH/USDC LP", amount: "1" }],
        feeUsd: 0.6,
        slippagePct: 0.3,
        aprPct: 22,
      },
      risks: ["IL"],
      calldata: {
        to: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
        data: "0xef",
        value: "0",
      },
    },
  ];
}

test("REJECT: 2-pool LP basket with 90/10 split exceeds tier.cap.single-pool@50%", () => {
  // 40% lending + 60% LP split 90/10 → LP cap OK, single-pool cap rejects
  const steps = [
    lendingTaggedStep("lendA", 800),                         // 40% lending
    ...lpTaggedStepOnPool("lpA", "aerodrome-base", 1080),    // 90% of LP capital
    ...lpTaggedStepOnPool("lpB", "uniswap-v3-base", 120),    // 10%
  ];
  const r = evaluatePlan(plan("balanced", steps), ctx("balanced"));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.ruleId, "tier.cap.single-pool");
});

test("PASS: 2-pool LP basket 50/50 satisfies tier.cap.single-pool", () => {
  const steps = [
    lendingTaggedStep("lendA", 800),                         // 40% lending
    ...lpTaggedStepOnPool("lpA", "aerodrome-base", 600),     // 50% of LP capital
    ...lpTaggedStepOnPool("lpB", "uniswap-v3-base", 600),    // 50%
  ];
  const r = evaluatePlan(plan("balanced", steps), ctx("balanced"));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.ok(
      r.plan.guardrails.appliedRules.some((x) => x.startsWith("tier.cap.single-pool@50%")),
    );
  }
});

test("PASS: single-pool LP basket is exempt from single-pool cap", () => {
  // 40% lending + 60% LP all in one pool → LP cap OK, single-pool cap exempt
  const steps = [
    lendingTaggedStep("lendA", 800),
    ...lpTaggedStepOnPool("lpA", "aerodrome-base", 1200),
  ];
  const r = evaluatePlan(plan("balanced", steps), ctx("balanced"));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.ok(
      r.plan.guardrails.appliedRules.some((x) =>
        x.startsWith("tier.cap.single-pool@n/a:single-pool-basket"),
      ),
    );
  }
});

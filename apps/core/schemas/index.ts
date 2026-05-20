import { z } from "zod";

export const QuestionIdSchema = z.enum([
  "horizon",
  "allocation",
  "experienceProducts",
  "experienceYears",
  "returnAttitude",
  "lossTolerance",
  "literacy",
  "derivativeExp",
]);

export const AnswerScoreSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const DefiExperienceCategorySchema = z.enum([
  "swap",
  "lending",
  "lp",
  "leverage",
  "perp",
]);

export const AgeBucketSchema = z.enum(["under65", "over65"]);

export const AnswersSchema = z.object({
  horizon: AnswerScoreSchema,
  allocation: AnswerScoreSchema,
  experienceProducts: z.array(DefiExperienceCategorySchema),
  experienceYears: AnswerScoreSchema,
  returnAttitude: AnswerScoreSchema,
  lossTolerance: AnswerScoreSchema,
  literacy: AnswerScoreSchema,
  derivativeExp: AnswerScoreSchema,
  ageBucket: AgeBucketSchema,
  firstTimeDefiPilot: z.boolean(),
});

export const TierSchema = z.enum([
  "preservation",
  "conservative",
  "balanced",
  "aggressive",
  "degen",
]);

// rawScore comes from scoreAnswers() which sums:
//   horizon (1..4) + inverseAllocation (1..4) + experienceProductScore (0..5)
//   + experienceYearsScore (0..5) + returnAttitudeScore (1..5)
//   + lossToleranceScore (1..5) + literacy (1..4) = 5..32.
const RAW_SCORE_MIN = 5;
const RAW_SCORE_MAX = 32;

export const TierResultSchema = z.object({
  tier: TierSchema,
  rawScore: z.number().int().min(RAW_SCORE_MIN).max(RAW_SCORE_MAX),
  derivativeExpScore: AnswerScoreSchema,
  downgradedFromDegen: z.boolean(),
  vulnerableDowngrade: z.boolean(),
  reason: z.string().optional(),
});

export const ParsedIntentSchema = z.object({
  asset: z.object({
    symbol: z.string().min(1),
    chainId: z.number().int().positive(),
  }),
  amount: z.string().regex(/^\d+(\.\d+)?$/, "amount must be a decimal string"),
  horizon: z.enum(["short", "mid", "long"]).optional(),
  preferences: z.array(z.string()).optional(),
  rawText: z.string().min(1).max(1000),
});

export const ActionKindSchema = z.enum([
  "swap",
  "bridge",
  "lend.supply",
  "lend.withdraw",
  "lp.add",
  "lp.remove",
  "lp.stake",
  "lp.claim",
]);

export const RiskTagSchema = z.enum([
  "IL",
  "leverage",
  "fresh-pool",
  "non-audited",
  "bridge",
]);

export const TokenAmountSchema = z.object({
  token: z.string(),
  amount: z.string(),
});

const HexAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/) as unknown as z.ZodType<`0x${string}`>;

const HexDataSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]*$/) as unknown as z.ZodType<`0x${string}`>;

export const PlanStepSchema = z.object({
  id: z.string().min(1),
  kind: ActionKindSchema,
  chainId: z.number().int().positive(),
  protocol: z.string().min(1),
  params: z.record(z.unknown()),
  expected: z.object({
    inputs: z.array(TokenAmountSchema),
    outputs: z.array(TokenAmountSchema),
    feeUsd: z.number().nonnegative(),
    slippagePct: z.number().nonnegative(),
    aprPct: z.number().optional(),
  }),
  risks: z.array(RiskTagSchema),
  calldata: z.object({
    to: HexAddressSchema,
    data: HexDataSchema,
    value: z.string(),
  }),
});

export const PipelinePlanSchema = z.object({
  planId: z.string().min(1),
  tier: TierSchema,
  intent: ParsedIntentSchema,
  steps: z.array(PlanStepSchema).max(8, "agent.steps.max: <=8 steps per plan"),
  aggregate: z.object({
    estimatedAprPct: z.number(),
    estimatedGasUsd: z.number().nonnegative(),
    riskFlags: z.array(z.string()),
  }),
  guardrails: z.object({
    appliedRules: z.array(z.string()).min(1, "guardrails.appliedRules must be non-empty"),
    rejectedAlternatives: z.array(z.string()).optional(),
  }),
  createdAt: z.string(),
});

export const StepStatusSchema = z.enum([
  "pending",
  "signed",
  "broadcasted",
  "confirmed",
  "failed",
  "skipped",
]);

export const ExecutionResultSchema = z.object({
  planId: z.string(),
  perStep: z.array(
    z.object({
      stepId: z.string(),
      txHash: HexDataSchema.optional(),
      status: StepStatusSchema,
      error: z.string().optional(),
    }),
  ),
  finishedAt: z.string().optional(),
});

export const PlanRequestSchema = z.object({
  tier: TierSchema,
  rawScore: z.number().int().min(RAW_SCORE_MIN).max(RAW_SCORE_MAX),
  literacyScore: AnswerScoreSchema,
  derivativeExpScore: AnswerScoreSchema,
  vulnerableConsumer: z.boolean(),
  intentText: z.string().min(3).max(1000),
  wallet: z.object({
    address: HexAddressSchema,
    chainId: z.number().int().positive(),
    gasBalanceWei: z.string(),
    holdings: z.array(
      z.object({
        symbol: z.string(),
        amount: z.string(),
        chainId: z.number().int().positive(),
      }),
    ),
  }),
});

export type PlanRequest = z.infer<typeof PlanRequestSchema>;

// --- defi-cli output schemas (§8.4 agent.io.zod) -----------------------------

export const DefiCliTxSchema = z.object({
  to: HexAddressSchema,
  data: HexDataSchema,
  value: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

export const DefiCliQuoteSchema = z
  .object({
    tx: DefiCliTxSchema.optional(),
    details: DefiCliTxSchema.partial().optional(),
    calldata: DefiCliTxSchema.optional(),
    to: HexAddressSchema.optional(),
    data: HexDataSchema.optional(),
    value: z.union([z.string(), z.number()]).optional(),
    amount_out: z.string().optional(),
    price_impact_pct: z.number().optional(),
    slippage_pct: z.number().optional(),
    gas_estimate_usd: z.number().optional(),
    aggregator: z.string().optional(),
    provider: z.string().optional(),
    status: z.string().optional(),
    error: z.string().optional(),
  })
  .refine(
    (q) => Boolean(q.error || q.tx || q.details?.to || q.calldata || (q.to && q.data)),
    "defi-cli quote must include error, tx, details, calldata, or top-level to+data",
  );

export const YieldScanRowSchema = z.object({
  protocol: z.string(),
  chain: z.string(),
  symbol: z.string().optional(),
  pair: z.string().optional(),
  apr: z.number().optional(),
  apy: z.number().optional(),
  tvl_usd: z.number().optional(),
});

export const YieldScanSchema = z.array(YieldScanRowSchema);

export const PriceRowSchema = z.object({
  symbol: z.string(),
  price_usd: z.number().optional(),
  source: z.string().optional(),
});

export const PriceResponseSchema = z.union([
  PriceRowSchema,
  z.array(PriceRowSchema),
]);

export const StatusChainSchema = z.object({
  chain: z.string(),
  chain_id: z.number().int().positive(),
  rpc_url: z.string().url().optional(),
  protocols: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      category: z.string(),
      interface: z.string(),
    }),
  ),
});

export const StatusResponseSchema = z.array(StatusChainSchema);

export type DefiCliQuote = z.infer<typeof DefiCliQuoteSchema>;
export type YieldScanRow = z.infer<typeof YieldScanRowSchema>;
export type PriceRow = z.infer<typeof PriceRowSchema>;

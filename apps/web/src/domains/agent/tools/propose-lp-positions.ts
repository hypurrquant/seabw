import type { ToolResult } from "@hq/react/agent";
import { z } from "zod";

// Drift map with HQ apps/server/tools/hypurrquant-mcp-server.ts LpCardSchemaMcp:
// id -> LpCard.id
// rank -> LpCard.rank
// protocol -> LpCard.protocol
// chainId -> LpCard.chainId
// pair -> LpCard.pair
// poolAddress -> LpCard.poolAddress
// metrics -> LpCard.metrics
// position -> LpCard.position
// reasoning -> LpCard.reasoning
// recipe -> LpCard.recipe
// generatedAt is intentionally optional here; this browser handler fills it.
export const TokenRefSchema = z.object({
  symbol: z.string(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  decimals: z.number().int().min(0).max(36).optional(),
  logoUri: z.string().url().optional(),
});

export const LpCardSchema = z.object({
  id: z.string().min(1),
  rank: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  protocol: z.string(),
  chainId: z.number(),
  pair: z.object({ base: TokenRefSchema, quote: TokenRefSchema }),
  feeTier: z.number().optional(),
  poolAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  metrics: z.object({
    apr: z.number(),
    apr7dAvg: z.number().optional(),
    tvlUsd: z.number(),
    volume24hUsd: z.number().optional(),
    ilRisk: z.enum(["low", "medium", "high"]),
  }),
  position: z.object({
    suggestedAmountUsd: z.number().positive(),
    // priceRange / tokenSplit 는 UI 표시용 — recipe 의 tickLower/tickUpper 와
    // amount0/amount1 이 source of truth. AI 가 누락해도 zod 통과시킴 (UI 가 알아서
    // recipe 에서 추론하거나 "—" 로 표시).
    priceRange: z
      .object({
        lower: z.number(),
        upper: z.number(),
        unit: z.enum(["price", "tick"]),
      })
      .optional(),
    tokenSplit: z
      .object({
        base: z.number().min(0).max(1),
        quote: z.number().min(0).max(1),
      })
      .optional(),
  }),
  reasoning: z.object({
    fitForTier: z.string().min(1),
    pros: z.array(z.string()).max(3),
    cons: z.array(z.string()).max(3),
    tierAlignment: z.enum(["match", "stretch", "warning"]),
  }),
  recipe: z
    .array(
      z.object({
        atom: z.string().min(1),
        // AI 가 가끔 params 를 JSON string 으로 보냄 — preprocess 로 parse 시도.
        params: z.preprocess((v) => {
          if (typeof v === "string") {
            try { return JSON.parse(v); } catch { return v; }
          }
          return v;
        }, z.record(z.unknown()).refine(
          (p) => Object.keys(p).length > 0,
          { message: "recipe[].params must be a non-empty object" },
        )),
      }),
    )
    .min(1)
    .refine(
      (recipe) =>
        recipe.some((atom) => {
          if (atom.atom !== "mint") return false;
          const p = atom.params as Record<string, unknown>;
          const tl = p.tickLower;
          const tu = p.tickUpper;
          // 서버 스키마: token0Amount / token1Amount (NOT amount0/amount1).
          // BigIntLikeSchema 가 string|number 둘 다 허용 → 여기서도 둘 다 받음.
          const a0 = p.token0Amount;
          const a1 = p.token1Amount;
          const isNumLike = (v: unknown) =>
            typeof v === "string" ? /^-?\d+$/.test(v) : typeof v === "number" && Number.isFinite(v);
          if (typeof tl !== "number" || typeof tu !== "number" || tl >= tu) return false;
          if (!isNumLike(a0) || !isNumLike(a1)) return false;
          const both0 = String(a0) === "0" && String(a1) === "0";
          return !both0;
        }),
      {
        message:
          "recipe must contain at least one 'mint' atom with integer tickLower<tickUpper and non-zero token0Amount/token1Amount (decimal string or integer)",
      },
    ),
  estimatedGasUsd: z.number().optional(),
});

export const LpProposalSchema = z.object({
  cards: z.array(LpCardSchema).length(3),
  rationale: z.string().min(1),
  generatedAt: z.string().datetime().optional(),
});

export type LpCard = z.infer<typeof LpCardSchema>;
export type LpProposal = z.infer<typeof LpProposalSchema>;

type Deps = {
  pushProposal: (proposal: LpProposal) => void;
  /** Returns sum of (token0 valueUsd + token1 valueUsd) actually held by the
   *  user on `chainId`. Return null if balance/price data not yet hydrated —
   *  handler will skip the cap check rather than block UX on cold start. */
  getPairAvailableUsd?: (
    chainId: number,
    token0Address: string,
    token1Address: string,
  ) => number | null;
};

export function createProposeLpPositionsHandler(deps: Deps) {
  return async (args: unknown): Promise<ToolResult> => {
    const parsed = LpProposalSchema.safeParse(args);
    if (!parsed.success) {
      return {
        status: "error",
        code: "INVALID_ARGS",
        message: `LpProposal validation failed: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      };
    }

    // Structural guard: AI keeps hallucinating suggestedAmountUsd above user's
    // actual balance even when system prompt forbids it. Reject the whole
    // proposal so AI must regenerate with realistic numbers.
    if (deps.getPairAvailableUsd) {
      const issues: string[] = [];
      for (const card of parsed.data.cards) {
        const available = deps.getPairAvailableUsd(
          card.chainId,
          card.pair.base.address,
          card.pair.quote.address,
        );
        if (available == null) continue;
        // 1c tolerance for float noise.
        if (card.position.suggestedAmountUsd > available + 0.01) {
          issues.push(
            `card #${card.rank} ${card.pair.base.symbol}/${card.pair.quote.symbol}: suggested $${card.position.suggestedAmountUsd.toFixed(2)} exceeds user's pair holdings $${available.toFixed(2)}`,
          );
        }
      }
      if (issues.length > 0) {
        return {
          status: "error",
          code: "INVALID_ARGS",
          message: `LpProposal rejected — suggestedAmountUsd exceeds user's actual token holdings for the pair. Call get_enriched_balances({chainId: 999}) first, then lower each card's suggestedAmountUsd to fit within (token0 valueUsd + token1 valueUsd). Do not invent default amounts. Issues: ${issues.join("; ")}`,
        };
      }
    }

    const proposal: LpProposal = {
      ...parsed.data,
      generatedAt: parsed.data.generatedAt ?? new Date().toISOString(),
    };
    deps.pushProposal(proposal);

    return { status: "success", data: { received: true, cardCount: 3 } };
  };
}

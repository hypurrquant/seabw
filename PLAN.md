# DefiPilot — Product Plan

> A DeFi robo-advisor. Pick a risk profile, type an intent in plain English, get a simulated multi-step pipeline you can sign with your own wallet.

- **Status:** Pre-build planning (single source of truth before any scaffolding)
- **Timeline:** 48-hour hackathon
- **Engine:** [`@hypurrquant/defi-cli`](https://github.com/hypurrquant/defi-cli) — 5 chains, 39 protocols, MCP-ready, dry-run by default
- **Language convention:** All product copy, code identifiers, and this document are in English. Internal conversation may be Korean.

---

## Table of Contents

1. [TL;DR](#1-tldr)
2. [Problem & Vision](#2-problem--vision)
3. [Scope (48h)](#3-scope-48h)
4. [Personas](#4-personas)
5. [Product Spec](#5-product-spec)
6. [Architecture](#6-architecture)
7. [Data Contracts](#7-data-contracts)
8. [Guardrails](#8-guardrails)
9. [Tech Stack & Dependencies](#9-tech-stack--dependencies)
10. [Milestones (48h)](#10-milestones-48h)
11. [Demo Script](#11-demo-script)
12. [Open Questions](#12-open-questions)
13. [Glossary](#13-glossary)

---

## 1. TL;DR

DefiPilot turns "I have $3,000 USDC and I want yield" into a runnable DeFi pipeline.

1. **Profile** — User answers 5 questions, gets a tier: `Conservative` / `Balanced` / `Aggressive` / `Degen`.
2. **Intent** — User types a plain-English goal. An LLM agent maps it to a strategy that fits the tier.
3. **Pipeline** — The agent assembles a DAG of steps (bridge -> swap -> LP -> stake) using `defi-cli`.
4. **Simulate** — Every pipeline runs as a `defi-cli` dry-run first; expected APR, fees, slippage, and IL risk are shown.
5. **Sign** — The user signs each step from their own wallet (viem + WalletConnect). DefiPilot never holds keys.

Differentiation vs. existing DeFi:

| Existing aggregator     | DefiPilot                       |
| ----------------------- | ------------------------------- |
| User picks protocol     | Tier-aware AI recommendation    |
| Single transaction      | Whole pipeline simulated as DAG |
| Dense option panels     | "I want yield" -> executable plan|
| Trust the UI            | Pre-sign breakdown of every call|

---

## 2. Problem & Vision

### Problem
DeFi yields exist, but the surface area to access them is hostile to non-experts. A user must (a) know which protocols are safe, (b) figure out the right token / pool / chain, (c) build a multi-step transaction sequence, and (d) understand which risks (IL, smart-contract, rug, gas/MEV) apply to their plan. Most users give up or pick blindly.

### Vision
Be the front door to DeFi for people who can articulate a goal but not a strategy. Translate intent into a vetted pipeline, surface risks honestly, and let the user keep custody throughout.

### What we are *not*
- Not a custodial wallet.
- Not a yield aggregator that auto-rotates funds without consent.
- Not a research platform — strategy explanations are short, not deep dives.
- Not a chat interface — natural language is one input, but the DAG is the artifact.

---

## 3. Scope (48h)

### In scope
- 5-question risk profile (survey + scoring + tier mapping).
- Natural-language intent -> pipeline DAG via LangChain + defi-cli (MCP) tools.
- React Flow DAG visualization with per-step expected output and risk callouts.
- Simulation step (`defi-cli --json` dry-run) producing calldata bundles.
- WalletConnect-based signing flow (viem) per step.
- Guardrail policy layer (tier caps, protocol whitelist, slippage caps, agent schema validation).
- One end-to-end golden-path demo: USDC -> blue-chip LP on a supported chain.

### Out of scope (48h)
- Account abstraction / smart accounts.
- Auto-rebalancing or scheduled rotation.
- Mobile app.
- More than one chain in the demo (multi-chain is in architecture, but demoed on a single chain).
- Detailed protocol research pages.
- Tax accounting.
- Multi-account or team features.

### Stretch goals (only if Day 1 finishes ahead of plan)
- "Why this strategy?" expandable rationale per DAG node.
- Save & share a plan as a shareable link (no on-chain action).
- Voice input.
- Demo-mode toggle that swaps RPC to a fork.

---

## 4. Personas

| Persona      | Background                       | Primary goal                       | Likely tier    |
| ------------ | -------------------------------- | ---------------------------------- | -------------- |
| Sora         | TradFi PM, holds BTC on Coinbase | Yield on stables, no IL            | Conservative   |
| Min          | Hobby investor, used Uniswap     | 15-30% APR, blue-chip only         | Balanced       |
| Alex         | DeFi native, runs LP positions   | Highest yield, accepts emissions   | Aggressive     |
| Riku         | Degen, hunts new launches        | 100%+ APR, leverage, points farming| Degen          |

---

## 5. Product Spec

### 5.1 User flow (state machine)

```
[Landing] --> [RiskSurvey] --> [TierResult] --> [ConnectWallet]
                                                       |
                                                       v
                                                  [IntentInput]
                                                       |
                                          (LLM agent + guardrails)
                                                       v
                                                  [PlanReview]
                                          (DAG + simulation result)
                                              |              |
                                              v              v
                                          [SignStep]    [EditOrAbort]
                                              |
                                              v
                                          [Execution]
                                              |
                                              v
                                          [PortfolioSummary]
```

States and exits:

| State              | Purpose                                                | Exits                                       |
| ------------------ | ------------------------------------------------------ | ------------------------------------------- |
| `Landing`          | Pitch + CTA "Start"                                    | -> `RiskSurvey`                             |
| `RiskSurvey`       | Five questions, progress bar, no skip                  | -> `TierResult` on Q5 answer                |
| `TierResult`       | Show tier card + 1-line strategy preview               | -> `ConnectWallet`, back to `RiskSurvey`    |
| `ConnectWallet`    | WalletConnect modal                                    | -> `IntentInput` on connect                 |
| `IntentInput`      | Plain-English textarea + example chips                 | -> `PlanReview` on submit                   |
| `PlanReview`       | DAG + per-step sim + aggregate APR/risk/fees           | -> `SignStep`, `EditOrAbort`                |
| `SignStep`         | Per-step approval via WalletConnect                    | -> next step or `PortfolioSummary`          |
| `EditOrAbort`      | User can revise intent or drop the plan                | -> `IntentInput` or `Landing`               |
| `PortfolioSummary` | Post-run summary, tx hashes, positions                 | -> done                                     |

### 5.2 Risk profile survey

Five questions, weighted, deterministic scoring. All copy is final English.

| #  | Category          | Weight | Question                                                        | Option (score)                                                                                                                          |
| -- | ----------------- | ------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Q1 | Time horizon      | x2     | How long can you lock this capital without needing it?          | <3 mo (1) / 3 mo-1 yr (2) / 1-3 yr (3) / >3 yr (4)                                                                                      |
| Q2 | Drawdown response | x3     | Your portfolio drops 30% overnight. What do you do?             | Sell everything (1) / Sell part to limit loss (2) / Hold and wait (3) / Buy more — it's on sale (4)                                     |
| Q3 | Crypto experience | x2     | What's your hands-on crypto experience?                         | None (1) / Held BTC or ETH on a CEX (2) / Used a DEX or DeFi directly (3) / Run LP, leverage, or farming (4)                            |
| Q4 | Capital at risk   | x2     | What share of your liquid net worth is this capital?            | <5% (1) / 5-20% (2) / 20-50% (3) / >50% (4)                                                                                             |
| Q5 | DeFi literacy     | x1     | Which DeFi risks do you actually understand? (pick highest true)| None (1) / Smart-contract bugs (2) / + Impermanent loss (3) / + Rug pulls + gas/MEV (4)                                                 |

**Scoring**

```
total = 2*Q1 + 3*Q2 + 2*Q3 + 2*Q4 + 1*Q5     // range: 10 .. 40
```

**Tier mapping**

| Score range | Tier         | Tagline                                  | Example APR  |
| ----------- | ------------ | ---------------------------------------- | ------------ |
| 10–17       | Conservative | Capital preservation, predictable yield  | ~4–6%        |
| 18–24       | Balanced     | Steady growth with controlled exposure   | 15–30%       |
| 25–32       | Aggressive   | High yield from emissions and rotation   | 50%+         |
| 33–40       | Degen        | Maximum yield, maximum risk              | 100%+        |

**Degen safety filter (hard rule)**

If `total in [33, 40]` but `Q5 < 4`, the user is downgraded to `Aggressive` and shown:

> *"You're answering like a Degen, but you haven't confirmed you understand impermanent loss, rug pulls, and MEV. We've set you to Aggressive. Read the risk page and retake the quiz any time."*

Rationale: drawdown-tolerance alone does not certify literacy. Q5 acts as a gate, not just a score input. This is the strongest single user-protection rule in the system.

### 5.3 Strategy templates per tier

These are the high-level strategy families the agent is allowed to compose. Concrete protocol picks are driven by `defi-cli yield scan`.

| Tier         | Allowed strategy primitives                                                                       | Forbidden                                              |
| ------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Conservative | Stablecoin supply (Aave, Morpho), single-sided stable deposit, USD-pegged LP only                 | Volatile assets, LP with non-stables, leverage, bridges to non-major chains |
| Balanced     | Blue-chip LP (ETH/USDC, BTC/USDC) on audited DEXes, stable supply, single bridge hop allowed      | Leverage, fresh pools (<30 days), emissions-only farms |
| Aggressive   | High-APR LPs with active emissions, mid-cap pairs, multi-chain rotation                           | Leverage above 2x, unaudited protocols                 |
| Degen        | Leveraged farming, points programs, freshly-launched pools (with literacy gate already passed)    | (None enforced by code — only by tier caps)            |

### 5.4 Intent -> pipeline

Input contract:

- **Tier** (from survey, required).
- **Free text** (e.g., `"$3,000 USDC, want yield, hold for 6 months"`).
- **Wallet context** — connected chain ID, holdings, gas balance.

Output contract — see [Section 7](#7-data-contracts) for the `PipelinePlan` schema. The agent must:

1. Parse free text into a `ParsedIntent` (asset, amount, horizon, optional preferences).
2. Pick a `StrategyTemplate` allowed by the user's tier.
3. Resolve concrete protocols/tokens via `defi-cli yield scan` + `lending rates` + `lp discover --emission-only`.
4. Compose an ordered DAG of `defi-cli` actions.
5. Validate the DAG against the guardrail policy (Section 8) — reject if any rule fails.
6. Run a `defi-cli --json` dry-run on each action to produce calldata + expected output.
7. Return a `PipelinePlan` for the UI.

Example translation (Balanced tier):

```
Intent:   "$3,000 USDC, want yield, hold for 6 months"

Plan:
  1. swap   1500 USDC -> ETH on Base via kyber  (slippage <= 0.5%)
  2. lp.add ETH/USDC on Aerodrome              (range +/-5%)
  3. lp.stake LP-NFT into Aerodrome gauge

Expected: ~22% APR, est. gas 0.0007 ETH, IL exposure tagged
```

### 5.5 DAG visualization (React Flow)

- Each node = one `defi-cli` action with: action name, chain, protocol, tokens, expected input/output amounts.
- Edges = data dependencies (output token of step *i* feeds step *i+1*).
- Node badges: chain logo, protocol logo, slippage value, audit status.
- Hover on node = tooltip with the exact CLI invocation that would run.
- Risk callouts (IL, leverage, fresh pool) render as red corner tags.

---

## 6. Architecture

### 6.1 System diagram

```
+------------------------------------------------------------------------+
|                            Browser (Next.js 16)                        |
|                                                                        |
| +----------+   +---------------+   +------------+   +----------------+ |
| | Survey   |-->| Tier Engine   |-->| Intent UI  |-->| Plan Review    | |
| | (5 Qs)   |   | (pure TS)     |   | (textarea) |   | (React Flow)   | |
| +----------+   +---------------+   +-----+------+   +-----+----------+ |
|                                          |                |            |
|                                          v                v            |
|                                 +----------------+ +----------------+   |
|                                 | /api/plan      | | Signer         |   |
|                                 | (Next route    | | (viem +        |   |
|                                 |  handler)      | | WalletConnect) |   |
|                                 +--------+-------+ +--------+-------+   |
+----------------------------------------- | ---------------- | ---------+
                                           |                  |
                                           v                  v
                     +-----------------------------------+ +--------------+
                     | LangChain Agent (server)          | | User wallet  |
                     |  - tools = defi-cli MCP           | | (MetaMask /  |
                     |  - schema validation (Zod)        | |  Rabby / WC) |
                     |  - guardrail policy engine        | +------+-------+
                     +------------+----------------------+        |
                                  |                               |
                                  v                               v
                     +------------------------+         +----------------+
                     | @hypurrquant/defi-cli  |         | Public RPCs    |
                     |   yield scan / quote   |<--------| (chain-spec)   |
                     |   swap / lp / lend     |         |                |
                     |   --json dry-run       |         |                |
                     +------------------------+         +----------------+
```

### 6.2 Component responsibilities

| Component             | Owns                                                               | Does NOT own                              |
| --------------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| Survey + Tier Engine  | Scoring, mapping, literacy filter                                  | Persistence (sessionStorage only for demo)|
| Intent UI             | Free-text capture, example chips, char limit                       | LLM calls                                 |
| `/api/plan` route     | Auth context, rate limit, calling LangChain agent                  | UI rendering                              |
| LangChain agent       | Parsing intent, choosing strategy, calling defi-cli tools          | Signing                                   |
| Guardrail engine      | Policy checks on every proposed plan                               | Strategy selection                        |
| defi-cli              | All on-chain reads and calldata generation                         | Risk policy, intent parsing               |
| Signer (viem + WC)    | Wallet connection, per-step signing, broadcast                     | Plan building                             |
| Plan Review (UI)      | DAG render, simulation summary, approve/abort UI                   | Re-running simulation (cached in plan)    |

### 6.3 defi-cli integration mode

- **Transport:** MCP server (`defi-mcp` bundled in the npm package) registered with the LangChain agent. Fallback: child-process CLI with `--json` if MCP setup is flaky.
- **Mutation safety:** All actions run *without* `--broadcast`. defi-cli returns calldata + `to` + `value`; DefiPilot sends those to the wallet for user signing.
- **Schema discovery:** `defi schema` is called once on agent startup to load tool definitions dynamically; this avoids hardcoding protocol lists.
- **Yield data:** `yield scan`, `lending rates`, and `lp discover --emission-only` provide APR inputs; cached for 60 seconds per request.

### 6.4 Why this shape

- **No custodial component.** DefiPilot never has the user's private key. Signing always happens in the user's wallet.
- **defi-cli is the only execution surface.** All chain logic is delegated. We do not write protocol adapters.
- **The agent is gated by Zod schemas at the I/O boundary.** It cannot return an unexecutable plan because the schema is enforced before any UI rendering.
- **One server route, no DB.** State lives in client memory + sessionStorage for the demo. No accounts, no PII.

---

## 7. Data Contracts

These are the canonical TypeScript types that flow between layers. Zod schemas mirror these at runtime.

```ts
// --- Survey -------------------------------------------------------------
type QuestionId = "horizon" | "drawdown" | "experience" | "allocation" | "literacy";
type Answers = Record<QuestionId, 1 | 2 | 3 | 4>;
type Tier = "conservative" | "balanced" | "aggressive" | "degen";

interface TierResult {
  tier: Tier;
  rawScore: number;          // 10..40
  downgradedFromDegen: boolean;
  reason?: string;           // present when downgraded
}

// --- Intent -------------------------------------------------------------
interface ParsedIntent {
  asset: { symbol: string; chainId: number };
  amount: string;            // decimal string in human units
  horizon?: "short" | "mid" | "long";
  preferences?: string[];    // e.g. ["no-bridge", "stable-only"]
  rawText: string;
}

// --- Plan ---------------------------------------------------------------
type ActionKind = "swap" | "bridge" | "lend.supply" | "lend.withdraw"
                | "lp.add"  | "lp.remove" | "lp.stake" | "lp.claim";

interface PlanStep {
  id: string;
  kind: ActionKind;
  chainId: number;
  protocol: string;
  params: Record<string, unknown>;      // raw defi-cli params
  expected: {
    inputs:  Array<{ token: string; amount: string }>;
    outputs: Array<{ token: string; amount: string }>;
    feeUsd: number;
    slippagePct: number;
    aprPct?: number;
  };
  risks: Array<"IL" | "leverage" | "fresh-pool" | "non-audited" | "bridge">;
  calldata: {
    to: `0x${string}`;
    data: `0x${string}`;
    value: string;
  };
}

interface PipelinePlan {
  planId: string;
  tier: Tier;
  intent: ParsedIntent;
  steps: PlanStep[];
  aggregate: {
    estimatedAprPct: number;
    estimatedGasUsd: number;
    riskFlags: string[];
  };
  guardrails: {
    appliedRules: string[];      // e.g. "slippage-cap@0.5%", "whitelist@balanced"
    rejectedAlternatives?: string[];
  };
  createdAt: string;
}

// --- Execution ----------------------------------------------------------
interface ExecutionResult {
  planId: string;
  perStep: Array<{
    stepId: string;
    txHash?: `0x${string}`;
    status: "signed" | "broadcasted" | "confirmed" | "failed" | "skipped";
    error?: string;
  }>;
  finishedAt?: string;
}
```

**Invariants**
- A `PipelinePlan` is *only* renderable in `PlanReview` if `guardrails.appliedRules` is non-empty. The UI refuses to draw a plan that bypassed the policy engine.
- `PlanStep.calldata` is always populated; it is impossible to surface a step without having simulated it.
- The agent cannot return a `PlanStep` whose `kind` is not in the `ActionKind` union — Zod rejects at the boundary.

---

## 8. Guardrails

This section is the safety contract. Every rule listed here must be enforced in code by the guardrail policy engine **before** a plan reaches the UI. The engine is pure (no I/O), takes a candidate plan + context, and returns either `Ok(plan with appliedRules)` or `Reject(reason)`.

### 8.1 User-protection rules

| Rule ID                | Tier(s)            | Rule                                                                                              |
| ---------------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| `tier.cap.volatile`    | Conservative       | 0% of plan capital in volatile assets. Stables only.                                              |
| `tier.cap.lp`          | Balanced           | <=60% of plan capital in LP. Remainder in lending or held.                                        |
| `tier.cap.lp`          | Aggressive         | <=80% of plan capital in LP/farm.                                                                 |
| `tier.cap.leverage`    | Conservative, Balanced, Aggressive | No leverage > 1x.                                                                 |
| `tier.cap.leverage`    | Degen              | Leverage <= 3x hard cap.                                                                          |
| `tier.protocol.count`  | Conservative       | <=1 protocol.                                                                                     |
| `tier.protocol.count`  | Balanced           | <=3 protocols.                                                                                    |
| `tier.protocol.count`  | Aggressive         | <=5 protocols.                                                                                    |
| `tier.protocol.count`  | Degen              | <=8 protocols.                                                                                    |
| `tier.bridge.allowed`  | Conservative       | No bridges.                                                                                       |
| `tier.bridge.allowed`  | Balanced           | <=1 bridge hop, must be a major-chain pair (Base, BNB, HyperEVM, Mantle).                         |
| `tier.bridge.allowed`  | Aggressive, Degen  | <=2 bridge hops.                                                                                  |
| `survey.literacy.gate` | Degen              | If `Q5 < 4`, downgrade to Aggressive (see 5.2).                                                   |
| `firstrun.cap`         | Degen              | First deposit per user is capped at $10,000 equivalent during demo.                               |
| `firstrun.cap`         | Aggressive         | First deposit per user is capped at $50,000 equivalent during demo.                               |

### 8.2 Protocol whitelist

Per-tier whitelist is derived at build time from defi-cli's supported set, filtered by:

- **Audit:** at least one named audit (Trail of Bits, OZ, Spearbit, Code4rena, Cantina, Halborn, Quantstamp).
- **TVL floor:** >= $10M (Conservative >= $100M, Balanced >= $30M).
- **Age floor:** mainnet >= 30 days (Aggressive >= 14 days, Degen no floor).

The whitelist lives in `src/policy/whitelist.ts` as a typed map. Any protocol not on the tier's list is rejected — there is no "trust me bro" path.

### 8.3 Transaction-safety rules

| Rule ID                  | Rule                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `slippage.cap.stable`    | Stable-to-stable swaps: <= 0.10%.                                                                     |
| `slippage.cap.major`     | Major-asset swaps (ETH, BTC, USDC, USDT, DAI): <= 0.50%.                                              |
| `slippage.cap.longtail`  | Other swaps: <= 2.00% with explicit user confirm in modal.                                            |
| `slippage.absolute.max`  | Any swap > 5.00% is rejected outright, regardless of confirm.                                         |
| `deadline.enforce`       | Every swap/LP action must include a deadline <= 30 minutes from sign time.                            |
| `gas.cap`                | Estimated gas per step <= user's available gas balance x 0.7 (leaves headroom).                       |
| `mev.private-rpc`        | Mainnet ETH actions route through a private RPC (e.g. Flashbots Protect). Other chains: best-effort.  |
| `calldata.revalidate`    | Calldata is re-simulated against current state <= 30 seconds before signing.                          |
| `dust.skip`              | Steps producing < $1 of output are removed automatically with a note in the plan.                     |

### 8.4 Agent-safety rules

| Rule ID                | Rule                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `agent.io.zod`         | Every LLM tool-call output is parsed by Zod before use. Parse failures cause a hard retry, capped at 2.|
| `agent.tools.allowlist`| The agent is given only the tools enumerated in `src/agent/tools.ts`. No arbitrary `bash` / `fetch`. |
| `agent.token.exists`   | Every referenced token symbol must resolve to a known address in defi-cli for the target chain.       |
| `agent.protocol.exists`| Every referenced protocol must be present in the tier whitelist.                                      |
| `agent.steps.max`      | <= 8 steps per plan. Anything longer is rejected.                                                     |
| `agent.chain.max`      | <= 2 chains touched per plan.                                                                         |
| `agent.dry-run.mandatory` | A plan cannot be returned without a successful dry-run on every step.                              |
| `agent.timeout`        | Total agent run <= 30 s wall clock, including tool calls.                                             |

### 8.5 UX-safety rules

| Rule ID                  | Rule                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `ux.preSign.breakdown`   | Pre-sign modal lists: action, protocol, exact tokens, amounts in and out, slippage cap, deadline, fee.|
| `ux.preSign.diff`        | If state moved since simulation, recompute and re-show a diff badge before signing.                   |
| `ux.tier.upgrade.warn`   | When the user retakes the survey and moves up a tier, show a one-screen disclosure with new risks.    |
| `ux.first-time.cooldown` | First-time signers: a 5-second "Cancel" countdown before the WalletConnect prompt opens.              |
| `ux.risk.tags`           | Every DAG node carries its risk tag(s) (`IL`, `leverage`, `fresh-pool`, `non-audited`, `bridge`).     |
| `ux.copy.honest`         | No marketing copy claims "guaranteed" yield. APR is labeled "estimated, not guaranteed".              |

### 8.6 Operational-safety rules

| Rule ID                  | Rule                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `ops.ratelimit.plan`     | <= 10 plan requests per IP per minute.                                                                |
| `ops.audit.log`          | Every plan request is logged with (anon ID, tier, intent text length, time, applied/rejected rules). |
| `ops.partial.rollback`   | If step N fails after step N-1 succeeded, surface a recovery plan; never auto-execute reversal.       |
| `ops.demo.banner`        | When the env is `demo` (testnet or forked mainnet), a visible banner reads "DEMO — funds are fake".   |
| `ops.kill-switch`        | A single env var `DEFIPILOT_DISABLE_EXEC=true` disables the sign flow globally; UI explains why.      |
| `ops.sanctioned.block`   | If the connected address is on a publicly-available sanctions list, the sign flow refuses.            |

### 8.7 Failure modes and what happens

| Failure                                    | What the user sees                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Agent returns an unparseable plan          | "We couldn't build a safe plan for that. Try rephrasing or adjust your tier."               |
| All candidate plans rejected by guardrails | The reasons (e.g., "no protocol passed the whitelist for Conservative on this chain").      |
| Dry-run reverts on a step                  | The DAG marks that step red; we suggest the closest safe alternative or offer to abort.     |
| State moved since simulation               | Banner: "Prices moved. We re-checked your plan — review again before signing."              |
| Wallet rejects a sign                      | Step is parked; remaining steps disabled until the user resumes or aborts.                  |
| Network drops mid-execution                | Tx hash captured if broadcast; UI polls reorgs and shows final state.                       |

---

## 9. Tech Stack & Dependencies

| Layer            | Choice                                  | Why                                                                  |
| ---------------- | --------------------------------------- | -------------------------------------------------------------------- |
| Framework        | **Next.js 16** (App Router, Turbopack)  | Single repo, server route for agent calls, fast dev.                 |
| Language         | TypeScript                              | Type safety across the data contracts in 7.                          |
| Styling          | Tailwind CSS v4                         | Speed; design tokens via `@theme`.                                   |
| UI primitives    | shadcn/ui (Radix-based)                 | Accessible defaults; we customize.                                   |
| Visualization    | React Flow                              | DAG node/edge primitive that fits the plan model.                    |
| Wallet           | `viem` + WalletConnect v2 (Reown)       | Non-custodial signing, multi-wallet support.                         |
| LLM agent        | LangChain (or LangGraph) JS             | Tool-calling, structured outputs, retry policy.                      |
| Schema validation| Zod                                     | Runtime guard at every I/O boundary.                                 |
| Execution engine | `@hypurrquant/defi-cli` (MCP server)    | 5 chains, 39 protocols, dry-run by default.                          |
| Model            | Anthropic Claude (Sonnet 4.6 default)   | Tool use + structured output reliability.                            |
| Package manager  | pnpm                                    | Workspace-friendly, fast.                                            |
| Linting          | None (skipped to save time)             | Hackathon scope.                                                     |

**Env vars used**

```
ANTHROPIC_API_KEY=
WALLETCONNECT_PROJECT_ID=
DEFIPILOT_ENV=demo|prod
DEFIPILOT_DISABLE_EXEC=false
DEFI_PRIVATE_KEY=               # leave empty in production; defi-cli only runs dry-runs
BASE_RPC_URL=                   # optional override
HYPEREVM_RPC_URL=               # optional override
```

---

## 10. Milestones (48h)

Times are **hours from kickoff**. Strict — if a block is at risk by its end time, cut the stretch goal in that block.

### Day 1 — Foundation (0h -> 24h)

| Block      | Deliverable                                                                                   | Definition of done                                       |
| ---------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 0h–2h      | Repo scaffold, env, MCP wired                                                                 | `defi --json status` succeeds from inside the app.       |
| 2h–6h      | Risk survey + scoring + tier result UI                                                        | Manual run produces a stable tier; literacy filter works.|
| 6h–10h     | Data contracts + Zod schemas                                                                  | All section 7 types compile; Zod parses fixture plans.   |
| 10h–14h    | Agent + tool plumbing (intent -> plan, no UI yet)                                             | One fixture intent yields a valid `PipelinePlan` in dev. |
| 14h–18h    | Guardrail policy engine (rules from 8.1–8.4)                                                  | Rejects 3 hand-crafted bad plans; passes 3 good ones.    |
| 18h–24h    | Plan Review UI + React Flow DAG + simulation summary                                          | The fixture plan renders end-to-end visually.            |

### Day 2 — Polish & Demo (24h -> 48h)

| Block      | Deliverable                                                                                   | Definition of done                                       |
| ---------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 24h–28h    | WalletConnect + viem signer wired to plan steps                                               | Test wallet signs one plan step on testnet.              |
| 28h–32h    | End-to-end golden path live                                                                   | "USDC -> Aerodrome LP" plan runs all the way through.    |
| 32h–36h    | UX-safety rules (pre-sign modal, risk tags, demo banner)                                      | All 8.5 rules visible.                                   |
| 36h–40h    | Edge case handling + failure-mode UI (8.7)                                                    | Three intentional failures show the right copy.          |
| 40h–44h    | Demo script rehearsal + UI polish + landing page copy                                         | Two clean runs back-to-back.                             |
| 44h–48h    | Buffer + record demo video + finalize submission                                              | Submission ready 60 minutes before deadline.             |

**Cut list (drop in order if behind schedule):**

1. Demo video B-roll
2. Stretch goals from 3
3. Risk-tag tooltips (keep flat icons)
4. UX-safety cooldown countdown (keep the modal)
5. Failure-mode polish copy (keep functional fallback)

Anything beyond #5 means cutting into the demo path — escalate.

---

## 11. Demo Script

Two clean runs. Each ~90 seconds.

### Golden path

1. **Land.** Headline: "Tell us your DeFi goal. We'll build the plan."
2. **Survey.** Five questions in 30 seconds. Land on `Balanced` (score 22).
3. **Tier card.** "Balanced — Blue-chip LPs, no leverage. Estimated 15–30% APR."
4. **Connect.** WalletConnect QR. Pre-seeded demo wallet on testnet/fork.
5. **Intent.** Type: `"$3,000 USDC, want yield for ~6 months"`. Submit.
6. **Plan Review.** DAG appears with three nodes:
   - `Swap 1,500 USDC -> ETH on Base via KyberSwap`
   - `Add LP ETH/USDC on Aerodrome (range +/-5%)`
   - `Stake LP NFT in Aerodrome gauge`
   - Aggregate: Est. APR ~ 22%, gas ~ $1.20, IL risk tag visible.
7. **Pre-sign modal.** Shows the breakdown for step 1: input, output, slippage cap, deadline.
8. **Sign 3 transactions.** WalletConnect prompts; each step turns green.
9. **Summary.** Portfolio panel: position in Aerodrome gauge, tx hashes, expected APR.

### Failure path (30 seconds, after golden run)

1. Retake the survey. Answer as a `Degen` (max all four behavioral questions) but pick `None` for Q5.
2. Tier card shows: "Downgraded to Aggressive. Here's why."
3. Type a leveraged-farm intent.
4. Plan engine returns one node; pre-sign modal shows the new tier's caps.
5. **Pull-quote for judges:** "The system refuses to lever you into Degen territory until you can explain it."

---

## 12. Open Questions

These need a decision before the corresponding block starts. Track here, resolve before block start.

| #  | Question                                                                                    | Needed by | Owner |
| -- | ------------------------------------------------------------------------------------------- | --------- | ----- |
| Q1 | Which chain do we demo on? (Base preferred; HyperEVM as backup since it's hypurrquant's home)| 0h        | Founder|
| Q2 | Testnet fork vs real testnet for the demo wallet?                                           | 0h        | Founder|
| Q3 | LangChain JS vs LangGraph JS — pick one to avoid mid-build migration                        | 6h        | Founder|
| Q4 | Anthropic model: Sonnet 4.6 vs Haiku 4.5 for cost vs quality                                | 6h        | Founder|
| Q5 | WalletConnect-only, or also inject EIP-1193 for Rabby/MetaMask in browser?                  | 24h       | Founder|
| Q6 | Sanctions-list source for 8.6 `ops.sanctioned.block` — Chainalysis API vs OFAC static list   | 24h       | Founder|
| Q7 | First-deposit caps in 8.1 — keep for demo or drop to show "real product"?                   | 32h       | Founder|

---

## 13. Glossary

- **DAG** — Directed Acyclic Graph; the ordered, branchable shape of a plan.
- **IL (Impermanent Loss)** — Loss in dollar terms an LP suffers when the two pooled assets diverge in price vs. holding them.
- **MEV** — Maximal Extractable Value; profit miners/validators or searchers extract from transaction ordering.
- **Slippage** — Difference between expected and executed price on a swap.
- **Dry-run** — Simulating an action against current chain state without broadcasting.
- **Calldata** — The encoded payload sent to a contract; signing it commits the wallet to executing it.
- **Tier** — One of `Conservative`, `Balanced`, `Aggressive`, `Degen`; derived from the 5-question survey.
- **Whitelist** — The set of protocols the policy engine allows for a tier on a given chain.

---

*This document is the source of truth for the 48-hour build. Any change to scope, guardrails, or contracts is a change to this file.*

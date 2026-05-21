# DefiPilot

**A Personalized DeFi Advisor for Retail Investors — From KOFIA Survey to On-Chain LP in One Conversation**

[Features](#key-features) • [Architecture](#architecture) • [Demo](#demo-scenario) • [Tech Stack](#tech-stack) • [Getting Started](#getting-started)

---

## The Problem

Retail users hold stablecoins (USDC, USDT, DAI) and native assets (ETH, HYPE) but cannot get them on-chain productively without either:

- Reading whitepapers, comparing 30+ protocols, and learning concentrated-liquidity tick math, or
- Trusting an opaque "yield" product that ignores their actual risk profile.

Both paths fail the same retail user. There is no advisor that maps **regulatory-grade investor profiling** to **executable on-chain plans the user signs from their own wallet**.

## Our Solution

**DefiPilot** is a personalized DeFi advisor that runs the full retail-to-DeFi journey in a single conversation:

- **📋 Investor Profiling** — A 10-question survey based on the KOFIA (Korea Financial Investment Association) framework derives one of 5 tiers: `preservation · conservative · balanced · aggressive · degen`, each with hard bounds (max leverage, max LP cap, max bridge count, etc.).
- **💬 AI Advisor** — A profile-aware LLM answers in plain Korean/English, references the user's tier on every suggestion, and refuses requests that break the tier's hard limits.
- **🧰 Browser-Native Tool Loop** — The advisor reaches into the user's *own browser* — wallet, balances, prices, pool data, sign requests — through typed function calls. The AI never holds the user's keys; the browser does, and the AI just *asks* for what it needs.
- **🪪 LP Recommendation Cards** — Every LP recommendation is rendered as exactly 3 cards. No raw transaction JSON, no "shall I execute?" prompts. The user clicks the card they want.
- **🖋️ User-Signed Execution** — When the user accepts a card, the wallet auto-switches to HyperEVM (chain 999) and the user signs each step in their own wallet. DefiPilot never custodies assets.

---

## Key Features

### 1. KOFIA-Grade Investor Profiling

A 10-question survey covering investment horizon, allocation share, DeFi experience, loss tolerance, risk literacy, derivative experience, age, and vulnerable-consumer self-assessment. Output:

- `tier` ∈ `{preservation, conservative, balanced, aggressive, degen}`
- `rawScore`, hard bounds (`maxLeverage`, `maxLpCapUsd`, `maxBridges`, `maxProtocols`)
- Auto-downgrades for vulnerable consumers and unmet `degen` criteria

The tier and answers are injected into the AI session as a structured profile **and** as a first-user-message markdown block — redundant on purpose so the model cannot "forget" the user.

### 2. Browser-Native Tool Loop *(the core architectural idea)*

DefiPilot inverts the usual server-side-tools pattern. Most LLM products run their tools on the server: the LLM asks the server to "fetch a balance" or "sign a transaction," and the server holds the keys, the RPC connection, and the user's session. DefiPilot does the opposite — **the tools live in the user's browser, and the AI calls into the browser**.

The browser is treated as a runtime full of typed functions. Each function does one of:

- **Read on-chain state for this specific user** — wallet status, native balance, token balances, existing LP positions
- **Query market data scoped to user-relevant assets** — candidate pools, pool details, prices, tick data
- **Pure computation** — optimal range derivation, deposit-amount splits, swap routing math
- **Mutate the wallet** — request a chain switch, request a signature

Every function is statically typed with a runtime schema, so the AI's call is validated *before* it ever touches the browser. Schema violations are rejected without side effects.

The interaction loop:

```
┌──────────────────────────┐
│  AI streams a response   │
└────────────┬─────────────┘
             │  emits  tool_call { name, args }
             ▼
┌──────────────────────────────────────────────────────────┐
│  Browser                                                 │
│  1. Validate args against the function's schema          │
│  2. Run the function inside the browser tab              │
│     (read user wallet, query RPC, run computation, ...)  │
│  3. Wrap the return value as tool_result                 │
└────────────┬─────────────────────────────────────────────┘
             │  tool_result { ok, data | error }
             ▼
┌──────────────────────────┐
│  AI resumes the stream   │  → may call more tools, or finalize answer
└──────────────────────────┘
```

Why this matters:

- **The user's keys never leave the browser.** Signing happens in the wallet extension the user already trusts. The advisor cannot impersonate the user; it can only *ask* the browser to ask the wallet.
- **No server-side per-user RPC cache.** The browser already knows which chain the user is on, which tokens they hold, which positions they have. The AI reads it directly from where it lives.
- **The same loop covers reads, math, and writes.** A "read your balance" call and a "request a signature" call look identical to the AI — same call shape, same schema validation, same `tool_result`. The advisor doesn't need a separate "execution mode."
- **A schema-validated transcript.** Every step the advisor took is a `(tool_call, tool_result)` pair. Debugging is reading the transcript, not reconstructing what the server thought it was doing.

### 3. LP Recommendation Cards (always 3)

LP recommendations are rendered as exactly 3 cards every time — including for `preservation` tier and zero-balance users. Conservatism is expressed in *which* 3 pools the advisor picks (e.g., 3 stable-stable fee tiers, or 1 stable-stable + 2 conservative stable-volatile), not by dropping the count below 3.

Each card encodes the on-chain steps the advisor would take, so when the user clicks, the wallet already knows what to sign.

### 4. Execution Modal with Auto Chain Switch

Clicking a card opens a dedicated execution modal that runs through four phases:

```
idle  →  executing  →  complete
                   ↘   error  (retry)
```

Before any signature is requested, the modal switches the wallet to HyperEVM (chain 999) automatically. If the user is on a different chain, their wallet prompts them to switch — they do not get a confusing `chain mismatch` failure mid-signing.

### 5. SIWE Wallet Auth

Authentication uses **Sign-In With Ethereum**: a challenge from the backend, a signature from the user's wallet, and a JWT bound to that address. The JWT survives reloads via local storage, so the chat URL is shareable across reloads while the wallet remains connected. No hardcoded bearer tokens, no dev-bypass.

### 6. Production Build Guard

The Next.js config rejects a production build unless:

- `NEXT_PUBLIC_DEFIPILOT_ENV=prod`
- `DEFIPILOT_ENV=prod`
- `DEFIPILOT_DEMO_BANNER=false`
- `NEXT_PUBLIC_DEFAULT_CHAIN_ID=999`
- `HYPEREVM_RPC_URL` is non-empty

Misconfigured prod envs throw at build time, not at runtime in front of users.

---

## Architecture

DefiPilot is a single-page web app. The chat backend is a separate service that streams the LLM's tokens and tool-call requests; everything that touches the user's wallet, balance, or chain runs inline in the browser tab.

```
┌────────────────────────────────────────────────────────────────────┐
│                            DefiPilot                               │
│   Landing → Connect Wallet (SIWE) → Survey → Tier Result → Chat    │
│                                                                    │
│  ┌─────────────────────────┐    ┌──────────────────────────────┐  │
│  │  Left pane              │    │  Right pane (chat)           │  │
│  │  Investor profile       │    │  AI advisor + LP cards +     │  │
│  │  (KOFIA tier + score)   │    │  execution modal             │  │
│  └─────────────────────────┘    └──────────────┬───────────────┘  │
│                                                 │                  │
│                         ┌───────────────────────┴───────────┐      │
│                         │   Browser-native tool runtime     │      │
│                         │   • typed function registry       │      │
│                         │   • schema-validated tool_call    │      │
│                         │   • wallet read & sign requests   │      │
│                         └───────────────────────┬───────────┘      │
└─────────────────────────────────────────────────┼──────────────────┘
                       SSE chat stream            │   wallet API
                       (token + tool_call)        │
                                ▲                 ▼
                                │           User's wallet extension
                  ┌─────────────┴────────────┐  (signs in-place)
                  │     Chat backend          │
                  │   (LLM streaming +        │
                  │    tool_call routing)     │
                  └───────────────────────────┘
```

Concretely:

1. The user signs into DefiPilot with their wallet (SIWE) and completes the survey.
2. The chat backend streams the advisor's response. Mid-stream, the advisor may emit a `tool_call`.
3. The browser receives the `tool_call`, validates its arguments against the function's schema, runs the function locally, and returns the result.
4. The advisor consumes the result and either calls more tools or finishes the message.
5. When the advisor proposes LP cards and the user clicks one, the execution modal walks the user through chain-switch and signing — every signature happens in the user's wallet extension, never on a server.

### Repository Layout

| Path | Description |
|------|-------------|
| `apps/web` | Next.js 15 frontend — the entire DefiPilot UX |
| `apps/web/src/domains/landing` | Hero + how-it-works narrative |
| `apps/web/src/domains/survey` | KOFIA 10-question survey + tier derivation |
| `apps/web/src/domains/wallet` | Wallet connect flow + connect-wallet modal |
| `apps/web/src/domains/auth` | SIWE challenge / sign / verify |
| `apps/web/src/domains/agent` | Browser-native tool runtime + function handlers |
| `apps/web/src/domains/chat` | Chat UI, LP cards, execution modal |
| `apps/web/src/domains/positions` | Existing-position views |
| `apps/web/src/lib` | Wallet config, chain registry, auth storage, prompts |
| `docs/phases/` | Per-version PRD + design + DoD + progress (v1.0.0 → v1.3.2) |
| `docs/seabw-system-prompt.md` | DefiPilot persona / tone / rules |
| `e2e/` | Playwright smoke suite (manual mode only) |
| `.github/workflows/ci.yml` | install · typecheck · lint · test · build |

---

## Demo Scenario

**"From survey to on-chain LP in under three minutes."**

```
Step 1  │  User lands on /, clicks "Connect wallet to start"
        │  → wallet opens → user picks address
        │
Step 2  │  SIWE challenge → user signs message → JWT issued
        │  → JWT cached locally (survives reloads)
        │
Step 3  │  10-question KOFIA survey
        │  → tier derived (e.g. "balanced", rawScore 18)
        │  → bounds: maxLpCapUsd $5,000, maxBridges 1
        │
Step 4  │  Chat opens. Split screen:
        │   Left  = report (tier + score + answers)
        │   Right = AI advisor, profile pre-injected
        │
Step 5  │  Advisor calls into the browser to read the user's state
        │   (wallet, balances, existing positions, candidate pools).
        │   Each call is one tool_call → tool_result round-trip.
        │
Step 6  │  Advisor proposes 3 LP cards:
        │   #1 USDC/USD₮0 0.05% (stable-stable, low risk)
        │   #2 USDC/USD₮0 0.30% (stable-stable, higher fee)
        │   #3 WHYPE/USDC 0.30% (conservative stable-volatile)
        │
Step 7  │  User clicks card #1
        │   → Execution modal opens
        │   → modal: "idle" (preparing…)
        │
Step 8  │  User clicks "Execute"
        │   → Auto chain switch to HyperEVM (chain 999)
        │   → modal: "executing" with step progress
        │   → each step signed in the user's wallet
        │
Step 9  │  All steps confirmed
        │   → modal: "complete" with tx hash links
        │   → position visible in /positions ✓
```

If anything fails — chain mismatch, simulation revert, user rejection — the modal moves to `error` with a single Retry button. No silent failures.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15 (App Router), React 19, TailwindCSS v4, Radix UI |
| **Wallet / Sign** | wagmi v2, viem, WalletConnect v2, SIWE |
| **AI Runtime** | Browser-native tool runtime with schema-validated `tool_call` / `tool_result` round-trips over SSE |
| **Auth** | SIWE (challenge → wallet sign → verify → JWT) |
| **Testing** | Vitest (unit / integration), Playwright (e2e manual) |
| **CI** | GitHub Actions — install · typecheck · lint · test · build |
| **Blockchain** | HyperEVM (Chain ID: 999), HYPE native |

---

## Getting Started

### Prerequisites

- Node.js ≥ 20, pnpm ≥ 10
- A chat backend reachable over HTTPS/SSE
- (Optional) WalletConnect Cloud project ID for the WalletConnect connector

### Quick Start

```bash
# 1. Clone & install
git clone <this-repo> defipilot
cd defipilot
pnpm install

# 2. Env setup
cp apps/web/.env.local.example apps/web/.env.local
# apps/web/.env.local minimum:
#   NEXT_PUBLIC_AGENT_ORIGIN=http://localhost:3003
#   NEXT_PUBLIC_AGENT_BASE_URL=http://localhost:3003/api/v1
#   (optional) NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...

# 3. Start the dev server
pnpm dev                # http://localhost:3000
```

### Verification

```bash
pnpm typecheck          # apps/web strict tsc
pnpm lint               # eslint flat config (max-warnings=0)
pnpm test               # vitest
pnpm build              # next build (prod env-guard enforced)
```

### Production env checklist

When `NEXT_PUBLIC_DEFIPILOT_ENV=prod`, the build throws unless **all** of:

- `DEFIPILOT_ENV=prod`
- `DEFIPILOT_DEMO_BANNER=false`
- `NEXT_PUBLIC_DEFAULT_CHAIN_ID=999`
- `HYPEREVM_RPC_URL` non-empty

are satisfied. Misconfiguration fails the build, not the user.

---

## Team

**Hypurrquant** — DeFi-native builders.

```
2024 Q1   AI research lab → on-chain
   ↓
2024 Q3   HypurrQuant — DEX LP management + trading bots
   ↓
2025 Q1   HypurrQuant V2 — multi-chain, non-custodial
   ↓
2025 Q4   ForwardX — cross-currency DeFi operations
   ↓
2026 Q1   Snowball — full-stack DeFi for Creditcoin
   ↓
2026 Q2   DefiPilot — KOFIA-tiered, retail-first DeFi advisor
```

---

Built on the KOFIA investor framework · wagmi v2 · viem · HyperEVM

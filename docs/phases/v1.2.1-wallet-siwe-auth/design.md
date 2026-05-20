# 설계 - v1.2.1 (2차: AI Tool Loop)

> 1차 SIWE Auth 의 design 은 README/PROGRESS 에 산출물 요약. 이 문서는 2차 AI Tool Loop 전용.

## 변경 규모
**규모**: 운영 리스크 + 서비스 경계
**근거**:
- 외부 monorepo (HQ) 의 packages 를 cross-repo workspace link → 서비스 경계.
- 인증 surface 가 `useAgentChat`/`previewRecipe`/`executeRecipe` 까지 확장.
- 21개 tool 핸들러 이식 + 1개 신규 (`propose_lp_positions`).
- Chat 흐름 자체를 `useAgentChat` 로 교체.
- Docker compose CORS environment 패치 필수.

---

## 문제 요약
seabw chat 이 HQ tool_call 을 placeholder error 로 일축 → AI 가 실시간 데이터/calldata 못 봄. 데모(2026-05-21) 종단 path ("LP 카드 3장 → 1 클릭 → 온체인 sign") 불가능. HQ `@hq/react/{agent,platform,defi,...}` + 21개 tool 핸들러를 seabw 에 통합 + `propose_lp_positions` 신규로 해결.

> 상세: [README.md](README.md) 참조

## 접근법

### 핵심 5가지
1. **HQ packages 통째 link**: pnpm workspace cross-directory — seabw `pnpm-workspace.yaml` 에 `../../side-project/.../packages/*` 추가.
2. **tool 핸들러 디렉토리째 복사**: HQ `apps/web/src/domains/agent/tools/` 의 21개 파일을 seabw 의 같은 경로로 복사.
3. **deps wiring**: `RegistryDeps` (`getPublicClient`, `getActiveAccount`, `balanceStore`, `getRelaySignDeps`, `getAuthToken`) 를 seabw 환경 구현.
4. **chat.tsx 흐름 교체**: 자체 SSE 루프 제거 → `useAgentChat` 사용. sessionId 는 seabw local state. profile injection 은 seabw `hq.createSession(profile)` wrapper 유지.
5. **propose_lp_positions 신규**: HQ MCP server schema 추가 + 브라우저 핸들러 추가 (LLM args → store push). 카드 UI 가 store 구독.

### 핵심 path (정합)
```
Provider 초기화
  ↓ HqBootProvider: setHttpBaseUrl(NEXT_PUBLIC_HQ_ORIGIN) + initPlatformDeps(...)
  ↓ AgentRuntimeProvider (mount 1회):
  ↓   registry = createBrowserToolRegistry(buildRegistryDeps(tokenRef))
  ↓   registry.register("propose_lp_positions", handler)
  ↓   initAgentDeps({ provider, toolRegistry: registry, chatHistory, apiBase })
  ↓   useAgentStore.auth ← AppState.auth.token (effect)

Chat stage 진입
  ↓ seabw hq.createSession(profile) → sessionId (profile injection 유지)
  ↓ useAgentChat({ sessionId }).sendMessage(tendencyPrompt, sessionId)

LLM 응답
  ↓ tool_call: propose_lp_positions(args)
  ↓ handler — zod 검증 + generatedAt 자동 채움 → useLpProposalStore.push() → tool_result success
  ↓ Chat 컴포넌트 — store 구독 → <LpCards/> 인라인 렌더

사용자 카드 클릭
  ↓ guardRecipe(card) — atom whitelist + chain allowlist + amount cap
  ↓ previewRecipe(card.recipe, ownerAddress, null) → RecipePreview { summary, resolved, previewedTick }
  ↓ usePipelineStore.addPendingResolved(sessionId, { pipelineId, recipe, summary, createdAt, previewedTick }, resolved)

chat UI
  ↓ pending pipeline 카드 inline 표시 (HQ ChatPanel 패턴)
  ↓ 사용자 Execute 버튼
  ↓ pipelineModal.execute(pipelineId, sessionId)
  ↓ executeRecipe → PlatformDeps.execute(request, description) → wagmi.sendTransaction
  ↓ markExecuted(sessionId, pipelineId, txHashes) → 데모 종료
```

---

## 대안 검토

### A. HQ packages 통합 방식

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| A1. workspace yaml 에 HQ packages 경로 추가 | transitive 자동 | install 이 HQ deps 끌어옴 | ❌ |
| A2. `file:` link (1 package 단위) | install 격리 | transitive 별도 add 필요 | △ |
| A3. **workspace cross-directory** (`packages: ['apps/*', '../../side-project/.../packages/*']`) | transitive 자동, 1회 install | HQ deps zerodev 등 무거움 — tree-shake 의존 | ✅ |
| A4. npm pack tarball | 견고 | 매 변경마다 repack | ❌ |

**선택 A3**.

### B. Chat 흐름 교체 vs 자체 SSE 유지

| 방식 | 채택 |
|------|------|
| B1. 자체 SSE + tool_call 만 registry 디스패치 | ❌ |
| B2. **`useAgentChat` 도입**. `sendMessage(text, sessionId)` 가 sessionId 직접 받음 → seabw 에서 `useState<string \| null>` 로 보관 | ✅ |

### C. propose_lp_positions

| 방식 | 채택 |
|------|------|
| C1. **LLM 이 LpProposal 직접 인코딩 → 핸들러는 store push** | ✅ |
| C2. 핸들러가 내부 fetch + 계산 | ❌ |

### D. recipe 필드

| 방식 | 채택 |
|------|------|
| D1. **`recipe: RecipeAtom[]`** (HQ 타입 그대로) | ✅ |
| D2. 간소 spec | ❌ |

### E. Fallback trigger

| 방식 | 채택 |
|------|------|
| E1. **system prompt 강제** + tendency 첫 메시지에 "반드시 propose_lp_positions" | ✅ |
| E2. **dev-only "추천 재요청" 버튼** | ✅ (보강) |
| E3. seabw 가 직접 hardcoded fallback | ❌ |

---

## 기술 결정

### 1. workspace 구조
```yaml
# seabw/pnpm-workspace.yaml
packages:
  - "apps/*"
  - "../../side-project/HypurrQuant_FE/worktrees/seabw-integration/packages/*"
```

### 2. seabw `apps/web/package.json` 추가 deps
```jsonc
{
  "dependencies": {
    "@hq/react": "workspace:*",
    "@hq/core": "workspace:*",
    "zustand": "^4.5.7"
    // wagmi v2 / viem / @tanstack/react-query 는 기존 유지 (HQ peer 호환)
  }
}
```

### 3. tool 디렉토리 복사 (seabw 내)
```
apps/web/src/domains/agent/
├─ tools/
│  ├─ BrowserToolRegistry.ts
│  ├─ index.ts                       # createBrowserToolRegistry(deps)
│  ├─ compose-pipeline/handler.ts
│  ├─ get-pools.ts ~ (21 핸들러)
│  └─ propose-lp-positions.ts        # 신규
├─ providers/
│  └─ ServerProxyProvider.ts          # HQ apps/web 에서 가져옴
└─ runtime/
   ├─ registry-deps.ts                # seabw wiring
   ├─ select-lp-card.ts
   └─ recipe-guard.ts
```

### 4. RegistryDeps wiring (seabw)
```ts
// apps/web/src/domains/agent/runtime/registry-deps.ts
import { createPublicClient, http } from "viem";
import type { RegistryDeps } from "../tools";
import { getAccount } from "wagmi/actions";
import { wagmiConfig } from "@/lib/wagmi";
import { SUPPORTED_CHAIN_MAP } from "@/lib/chains";

export function buildRegistryDeps(getAuthToken: () => string): RegistryDeps {
  const clients = new Map<number, ReturnType<typeof createPublicClient>>();
  return {
    getPublicClient(chainId) {
      if (!clients.has(chainId)) {
        clients.set(
          chainId,
          createPublicClient({ chain: SUPPORTED_CHAIN_MAP[chainId], transport: http() }),
        );
      }
      return clients.get(chainId)!;
    },
    getActiveAccount() {
      const account = getAccount(wagmiConfig);
      return {
        activeAddress: account.address ?? null,
        executionMode: "eoa",
        ready: account.status === "connected",
      };
    },
    balanceStore: createEphemeralBalanceStore(),    // P0 미사용, 빈 cache
    getRelaySignDeps: () => null,                    // cross-chain 미사용
    getAuthToken,                                     // AppState.auth.token
  };
}
```

### 5. Provider 트리
```tsx
<WagmiProvider>
  <QueryClientProvider>
    <AppStateProvider>
      <HqClientProvider>            {/* 1차: hq-api.ts factory */}
        <HqBootProvider>             {/* 신규: setHttpBaseUrl + initPlatformDeps */}
          <AgentRuntimeProvider>      {/* 신규: stable registry + initAgentDeps + useAgentStore sync */}
            <WalletModalProvider>
              {children}
              <ConnectWalletModal />
            </WalletModalProvider>
          </AgentRuntimeProvider>
        </HqBootProvider>
      </HqClientProvider>
    </AppStateProvider>
  </QueryClientProvider>
</WagmiProvider>
```

### 5-1. `HqBootProvider` (mount 즉시 1회)
**책임**: `setHttpBaseUrl` + `initPlatformDeps` 만. `initAgentDeps` 는 registry 생성 이후 `AgentRuntimeProvider` 에서.

```ts
import { setHttpBaseUrl } from "@hq/core/lib/http";
import { initPlatformDeps, type PlatformDeps } from "@hq/react/platform";
import { signMessage, sendTransaction } from "wagmi/actions";
import { wagmiConfig } from "@/lib/wagmi";

setHttpBaseUrl(process.env.NEXT_PUBLIC_HQ_ORIGIN!);   // origin 만

const platformDeps: PlatformDeps = {
  // execute(request, description): Promise<PlatformExecuteResult>
  // 실제 PlatformExecuteResult = { hash: `0x${string}` }
  execute: async (request, _description) => {
    const hash = await sendTransaction(wagmiConfig, request as never);
    return { hash };
  },
  signMessage: async (message) => signMessage(wagmiConfig, { message }),
  storage: typeof window !== "undefined" ? window.sessionStorage : ({} as Storage),
  showToast: (toast) => console.info("[toast]", toast.type, toast.title, toast.message),
  onBeforeUnload: (callback) => {
    if (typeof window === "undefined") return () => undefined;
    const handler = () => callback();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  },
  getSignDeps: () => null,
};

initPlatformDeps(platformDeps);
```

⚠️ `.env.local` 신규 변수: `NEXT_PUBLIC_HQ_ORIGIN=http://localhost:3003`. seabw 자체 `lib/hq-api.ts` 의 `NEXT_PUBLIC_HQ_BASE_URL=http://localhost:3003/api/v1` 는 그대로 유지 (1차 흐름 호환).

### 5-2. `AgentRuntimeProvider`
**책임**: stable registry 생성 (token 변경 시 재생성 안 함, ref 로 token 추적) + `propose_lp_positions` 등록 + `initAgentDeps` **mount 1회** + `useAgentStore` <-> SIWE token 동기화.

```ts
import { initAgentDeps } from "@hq/react/agent";
import { useRef } from "react";

const tokenRef = useRef<string>("");
tokenRef.current = state.auth.token ?? "";

// registry 는 mount 1회 — token 은 ref 로 lazy resolve → SIWE 후 token 바뀌어도 재생성 X
const registry = useMemo(
  () => createBrowserToolRegistry(buildRegistryDeps(() => tokenRef.current)),
  [],
);

// initAgentDeps 도 mount 1회 — HQ 가 중복 호출 throw 함
useEffect(() => {
  registry.register("propose_lp_positions", createProposeLpPositionsHandler({
    pushProposal: (p) => useLpProposalStore.getState().push(p),
  }));
  initAgentDeps({
    provider: new ServerProxyProvider(),
    toolRegistry: registry,
    chatHistory: new InMemoryChatHistoryAdapter(),
    apiBase: process.env.NEXT_PUBLIC_HQ_ORIGIN!,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// useAgentStore <-> SIWE token 동기화 (useAgentChat 가 store 의 auth 를 봄)
useEffect(() => {
  useAgentStore.setState({
    auth: {
      token: state.auth.token ?? null,
      expiresAt: state.auth.tokenExpiresAt ?? 0,
    },
  });
}, [state.auth.token, state.auth.tokenExpiresAt]);
```

⚠️ HQ `initAgentDeps` 는 중복 호출 시 throw. registry 와 init 모두 mount 1회로 고정, token 변경은 `tokenRef` lazy resolve 로만 전달.

### 6. Session 생성 (profile injection 유지)
HQ `useAgentSession(token).createSession()` 은 인자 없음 — seabw 의 profile injection 깨짐. **seabw 의 `useHqClient().createSession(profile)` wrapper 직접 사용** (S-A).

```ts
// Chat 컴포넌트 — sessionId 는 local state
const [sessionId, setSessionId] = useState<string | null>(null);
const chat = useAgentChat({ /* options */ });

useEffect(() => {
  if (sessionId) return;
  if (state.auth.status !== "authed") return;
  if (!state.answers || !state.tier) return;
  (async () => {
    const sid = await hq.createSession({ answers: state.answers!, tier: state.tier! });
    setSessionId(sid);
    const first = buildTendencyPrompt(state.answers!, state.tier!);
    chat.sendMessage(first, sid);    // sessionId 직접 전달
  })();
}, [state.auth.status, state.answers, state.tier]);

// 메시지 구독: useAgentStore.sessionStateById[sessionId]
const messages = useAgentStore((s) => s.sessionStateById?.[sessionId ?? ""]?.messages ?? []);
```

### 7. propose_lp_positions 구현

⚠️ **LLM 친화**: `generatedAt` handler 자동 채움 (LLM 불요). `TokenRef.decimals` optional. MCP schema 에 LpCard 골격 노출.

#### LpCard / LpProposal zod
```ts
// apps/web/src/domains/agent/tools/propose-lp-positions.ts
import { z } from "zod";

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
    priceRange: z.object({ lower: z.number(), upper: z.number(), unit: z.enum(["price", "tick"]) }).optional(),
    tokenSplit: z.object({ base: z.number().min(0).max(1), quote: z.number().min(0).max(1) }).optional(),
  }),
  reasoning: z.object({
    fitForTier: z.string().min(1),
    pros: z.array(z.string()).max(3),
    cons: z.array(z.string()).max(3),
    tierAlignment: z.enum(["match", "stretch", "warning"]),
  }),
  recipe: z.array(z.object({ atom: z.string(), params: z.unknown() })).min(1),
  estimatedGasUsd: z.number().optional(),
});

export const LpProposalSchema = z.object({
  cards: z.tuple([LpCardSchema, LpCardSchema, LpCardSchema]),
  rationale: z.string().min(1),
  generatedAt: z.string().datetime().optional(),
});

export type LpCard = z.infer<typeof LpCardSchema>;
export type LpProposal = z.infer<typeof LpProposalSchema>;
```

#### 핸들러
```ts
export function createProposeLpPositionsHandler(deps: { pushProposal: (p: LpProposal) => void }) {
  return async (args: unknown): Promise<ToolResult> => {
    const parsed = LpProposalSchema.safeParse(args);
    if (!parsed.success) {
      return {
        status: "error",
        code: "INVALID_ARGS",
        message: `LpProposal validation failed: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      };
    }
    const proposal: LpProposal = {
      ...parsed.data,
      generatedAt: parsed.data.generatedAt ?? new Date().toISOString(),
    };
    deps.pushProposal(proposal);
    return { status: "success", data: { received: true, cardCount: 3 } };
  };
}
```

#### MCP server schema (HQ worktree)
```ts
// apps/server/tools/hypurrquant-mcp-server.ts (추가)
const LpCardSchemaMcp = z.object({
  id: z.string(),
  rank: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  protocol: z.string(),
  chainId: z.number(),
  pair: z.object({
    base: z.object({ symbol: z.string(), address: z.string(), decimals: z.number().optional() }),
    quote: z.object({ symbol: z.string(), address: z.string(), decimals: z.number().optional() }),
  }),
  poolAddress: z.string(),
  metrics: z.object({
    apr: z.number(),
    tvlUsd: z.number(),
    ilRisk: z.enum(["low", "medium", "high"]),
  }),
  position: z.object({ suggestedAmountUsd: z.number() }),
  reasoning: z.object({
    fitForTier: z.string(),
    pros: z.array(z.string()).max(3),
    cons: z.array(z.string()).max(3),
    tierAlignment: z.enum(["match", "stretch", "warning"]),
  }),
  recipe: z.array(z.object({ atom: z.string(), params: z.any() })).describe("RecipeAtom[]"),
});

server.tool('propose_lp_positions', `Propose exactly 3 LP positions to user as visual cards.

Use AFTER get_wallet_status / get_pools / get_token_prices to gather actual data.
The user will see 3 cards and click one to execute its 'recipe' via compose_pipeline.

Rules:
- MUST return exactly 3 cards.
- Rank 1 = conservative match for user's tier; rank 3 = opportunistic.
- 'recipe' field is the RecipeAtom[] sent to /pipeline/resolve when user clicks.
- All 3 cards must respect tier hard limits (no leverage for conservative/balanced).
- 'reasoning.fitForTier' must reference tier explicitly.
- 'generatedAt' is auto-filled; omit it.`, {
  cards: z.tuple([LpCardSchemaMcp, LpCardSchemaMcp, LpCardSchemaMcp]),
  rationale: z.string(),
}, (args) => callTool('propose_lp_positions', args));
```

⚠️ **codex 인식 검증**: 컨테이너 재기동 → 새 chat session 1회 띄움 → LLM 에 "list tools" → `propose_lp_positions` 포함 확인.

#### Zustand store
```ts
// apps/web/src/domains/agent/store/useLpProposalStore.ts
import { create } from "zustand";
import type { LpProposal } from "../tools/propose-lp-positions";

interface LpProposalStore {
  current: LpProposal | null;
  push: (p: LpProposal) => void;
  clear: () => void;
}

export const useLpProposalStore = create<LpProposalStore>((set) => ({
  current: null,
  push: (p) => set({ current: p }),
  clear: () => set({ current: null }),
}));
```

### 8. LP 카드 UI

#### `apps/web/src/domains/chat/lp-cards.tsx`
- props 없음. `useLpProposalStore` 구독.
- proposal 없으면 null.
- 3 카드 grid. 각 카드: protocol + pair + APR + TVL + IL badge + tier alignment 컬러 + fitForTier + pros/cons 2 + suggested amount + "Choose" 버튼.
- "Choose" 클릭 → `selectLpCard(card, ctx)`.

### 9. `selectLpCard` (실제 HQ API 정합)
```ts
// apps/web/src/domains/agent/runtime/select-lp-card.ts
import { previewRecipe } from "@hq/react/defi/pipeline";
import { usePipelineStore } from "@hq/react/agent";
import type { RecipeAtom } from "@hq/core/defi/pipeline/types";
import { guardRecipe } from "./recipe-guard";

export async function selectLpCard(card: LpCard, ctx: {
  ownerAddress: `0x${string}`;
  sessionId: string;
}): Promise<void> {
  // 0) client guard
  guardRecipe(card);

  // 1) HQ previewRecipe (PlatformDeps.signMessage + ensurePipelineAuthToken 내부)
  const preview = await previewRecipe(
    card.recipe as RecipeAtom[],
    ctx.ownerAddress,
    null,                                  // tickProvider — mint preview 시 별도 wiring
  );

  // 2) addPendingResolved(sessionId, base: PipelineBase, resolved)
  const pipelineId = `lp-card-${card.id}-${Date.now()}`;
  usePipelineStore.getState().addPendingResolved(
    ctx.sessionId,
    {
      pipelineId,
      recipe: card.recipe as RecipeAtom[],
      summary: preview.summary,
      createdAt: Date.now(),
      previewedTick: preview.previewedTick,
    },
    preview.resolved,
  );

  // 3) chat UI 가 store 의 pending pipeline 을 인라인 카드로 렌더
  //    사용자 Execute 버튼 → useAgentPipelineModal().execute(pipelineId, sessionId)
}
```

### 10. `guardRecipe` (P0 client guard)
```ts
// apps/web/src/domains/agent/runtime/recipe-guard.ts
import type { RecipeAtom } from "@hq/core/defi/pipeline/types";
import type { LpCard } from "../tools/propose-lp-positions";

const ALLOWED_ATOMS = new Set(["mint", "farm"]);     // P0 LP 진입 path
const CHAIN_ALLOWLIST = new Set([999, 8453]);         // hyperEvm, base
const MAX_AMOUNT_USD = 1000;

export function guardRecipe(card: LpCard): void {
  // amount cap — card.position.suggestedAmountUsd 기준
  if (card.position.suggestedAmountUsd > MAX_AMOUNT_USD) {
    throw new Error(`suggestedAmountUsd ${card.position.suggestedAmountUsd} exceeds $${MAX_AMOUNT_USD} cap`);
  }
  // chain allowlist
  if (!CHAIN_ALLOWLIST.has(card.chainId)) {
    throw new Error(`chain ${card.chainId} not allowed in P0`);
  }
  // atom whitelist
  const atoms = card.recipe as RecipeAtom[];
  if (atoms.length === 0 || atoms.length > 5) {
    throw new Error(`recipe length ${atoms.length} out of range`);
  }
  for (const a of atoms) {
    if (!ALLOWED_ATOMS.has(a.atom)) {
      throw new Error(`recipe atom '${a.atom}' not allowed in P0`);
    }
    const chainIdInParams = (a.params as { chainId?: number }).chainId;
    if (chainIdInParams != null && !CHAIN_ALLOWLIST.has(chainIdInParams)) {
      throw new Error(`atom chainId ${chainIdInParams} not allowed`);
    }
  }
}
```

### 11. Pipeline Ready 카드 + Execute (seabw local executor)
**결정**: `useAgentPipelineModal` 미사용 (AccountStore 의존 회피). seabw 가 자체 executor 로 직접 `executeRecipe` 호출.

```ts
// apps/web/src/domains/agent/runtime/execute-pipeline.ts
import { executeRecipe } from "@hq/react/defi/pipeline";
import { usePipelineStore } from "@hq/react/agent";

/**
 * `executeRecipe` 는 `Promise<void>` 반환. tx hash 는 onStepComplete callback 으로 수집.
 * ExecutorCallbacks 필수 필드:
 *  - onInit(steps): 시작 시 1회 — totalSteps 알림
 *  - onStepStart(stepId): 각 step 시작
 *  - onStepComplete(stepId, txHash?): 각 step 완료 — txHash 가 있을 때만 push
 *  - onStepSkipped(stepId, reason)
 *  - onStepError(stepId, error)
 *  - onStepsSkipped(steps)
 *  - onStageSkipped: null | (stageId, reason)
 *  - onComplete(): 전체 완료
 *  - onError(error): 전체 실패
 */
export async function executePendingPipeline(
  pipelineId: string,
  sessionId: string,
  ownerAddress: `0x${string}`,
): Promise<void> {
  const entry = usePipelineStore.getState().pipelines[pipelineId];
  if (!entry) throw new Error(`pipeline ${pipelineId} not found`);

  usePipelineStore.getState().markExecuting(sessionId, pipelineId);

  const txHashes: string[] = [];

  await executeRecipe(
    entry.recipe,
    ownerAddress,
    {
      onInit: (steps) => {
        usePipelineStore.getState().initProgress(pipelineId, steps.length);
      },
      onStepStart: () => {},
      onStepComplete: (_stepId, txHash) => {
        if (txHash) txHashes.push(txHash);
        usePipelineStore.getState().updateProgress(pipelineId, txHashes.length);
      },
      onStepSkipped: () => {},
      onStepError: () => {},
      onStepsSkipped: () => {},
      onStageSkipped: null,
      onComplete: () => {
        usePipelineStore.getState().markExecuted(sessionId, pipelineId, txHashes);
        usePipelineStore.getState().clearProgress(pipelineId);
      },
      onError: (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        usePipelineStore.getState().markFailed(sessionId, pipelineId, msg);
        usePipelineStore.getState().clearProgress(pipelineId);
      },
    },
    null,    // tickProvider — P0 미사용
  );
}
```

⚠️ Callbacks 의 정확한 시그니처는 `packages/react/defi/pipeline/executeRecipe.ts` 의 `ExecutorCallbacks` 타입을 Step 5A 첫 티켓에서 검증. 위는 design 의도, 누락 필드 발견 시 추가.

#### UI
- chat 흐름 안에서 `usePipelineStore((s) => s.pipelines[pipelineId])` 구독.
- status = `pending` → "Pipeline Ready" 카드 + Execute 버튼 + summary.
- status = `executing` → progress bar + spinner.
- status = `executed` → success badge + txHashes 표시.
- status = `failed`/`resolve_failed`/`rejected` → 에러 메시지 + retry 옵션 (재요청).

⚠️ `executeRecipe` 의 실제 시그니처 (callbacks, tickProvider) 는 Step 5A 첫 티켓에서 코드로 검증. 위 의사코드는 design 의도, 정확한 callback shape 은 구현 시 `packages/react/defi/pipeline/executeRecipe.ts` 참조.

### 12. Docker compose CORS 패치
```yaml
# HQ worktree docker-compose.local.yml
environment:
  CORS_ORIGIN: http://localhost:3002,https://app.hypurrquant.com,https://test.hypurrquant.com,http://localhost:3000
```

`.env.local` 의 같은 변수는 무시됨 → environment 줄 직접 수정.

### 13. system prompt
`docs/seabw-system-prompt.md` 마지막에 추가:
```
## Tool 사용 규칙 (CRITICAL)

흐름:
1. get_wallet_status — 지갑/체인 확인
2. get_pools 또는 get_pool_detail — 후보 풀 수집
3. get_token_prices — USD 가치
4. (선택) calculate_optimal_range
5. propose_lp_positions — **반드시** 정확히 3개 LpCard 로 호출

propose_lp_positions 없이 텍스트만으로 LP 추천 금지.
3장 모두 tier hard limits 준수 (conservative/balanced 는 leverage 금지).
generatedAt 은 보내지 마세요 (서버가 채움).

LpCard.recipe 예시 (mint):
[
  { "atom": "mint", "params": { "chainId": 999, "poolAddress": "0x...", "amount0": "...", "amount1": "...", "tickLower": ..., "tickUpper": ... } }
]
```

### 14. Dev-only Force Refresh 버튼
chat header 의 "← Back to report" 옆에 `NODE_ENV !== "production"` 일 때 "🔄 추천 재요청" 노출. 클릭 시 tendency prompt 재발송.

---

## 범위 / 비범위

### 범위 (In Scope)
- pnpm workspace cross-directory link.
- `@hq/react`, `@hq/core` 의존 추가 (+ transitive `@hq/react/{platform,agent,defi,...}`).
- 21개 HQ tool 핸들러 + `BrowserToolRegistry` + `ServerProxyProvider` 이식.
- `propose_lp_positions` 신규 (handler + zod + MCP schema).
- `buildRegistryDeps` seabw wiring.
- `HqBootProvider` (setHttpBaseUrl + initPlatformDeps).
- `AgentRuntimeProvider` (stable registry + propose handler 등록 + initAgentDeps mount 1회 + useAgentStore 동기화).
- `useAgentChat` 도입 (자체 SSE 제거).
- `useHqClient().createSession(profile)` wrapper 유지.
- `useLpProposalStore` + `<LpCards/>` UI + `selectLpCard` + `guardRecipe`.
- chat 메시지 흐름 안 Pipeline Ready 인라인 카드 (HQ ChatPanel 패턴).
- HQ MCP server `propose_lp_positions` schema + 컨테이너 재기동 + codex 인식 검증.
- HQ docker-compose `environment.CORS_ORIGIN` 에 `:3000` 추가.
- system prompt 갱신.
- dev-only Force Refresh 버튼.

### 비범위 (Out of Scope)
- (P1) 16개 비-P0 tool 동작 검증.
- portfolio 도메인.
- 카드 비교/재추천/슬리피지 UI.
- LpCard metrics 검증.
- 다중 chain 동시 시연.
- AccountAbstraction.
- E2E 자동 테스트.
- HQ 새 tool 자동 sync.
- AccountStore wiring — `useAgentPipelineModal` 미사용, seabw local `executePendingPipeline` 가 `executeRecipe` 직접 호출.

## 가정 / 제약

### 가정
- HQ `@hq/react`, `@hq/core` 가 seabw react 19 환경에서 19-only API 안 쓰고 동작.
- `previewRecipe` / `executeRecipe` 가 `getPlatformDeps().signMessage` + 서버 `/pipeline/resolve` 호출 (HQ 책임).
- HQ `/pipeline/resolve` 가 `Authorization: Bearer <SIWE token>` 받음. 토큰은 HQ `ensurePipelineAuthToken` 가 내부 처리.
- HQ MCP server 가 schema 추가 + 컨테이너 재빌드 후 codex spawn 시점에 인식.
- 데모용 chain (hyperEvm 또는 base) 에 mint 가능한 pool 1개 이상.
- 사용자 지갑이 데모 chain native + LP pair token 보유.

### 제약
- 데모 1일 — 의존성 충돌 시 시간 부족.
- react 19/18 peer 충돌 시 fallback 없음 (peerDep override 패치는 R8).
- `@zerodev/*` peerDep 충돌 시 활성화 없음만으로 통과해야.

## 아키텍처 개요

### 컴포넌트 트리
```
<Providers>
  ├─ WagmiProvider
  ├─ QueryClientProvider
  ├─ AppStateProvider                [1차]
  ├─ HqClientProvider                [1차]
  ├─ HqBootProvider                   [신규]
  ├─ AgentRuntimeProvider             [신규]
  └─ WalletModalProvider               [1차]
     ├─ <SiteHeader/> + <WalletBadge/>  [1차]
     ├─ <Router>
     │   ├─ landing
     │   ├─ connect-wallet            [1차]
     │   ├─ survey
     │   ├─ tier-result
     │   └─ chat (split-screen)        [변경]
     │       ├─ <TierResultView readOnly />
     │       └─ <Chat/>                 [재작성: useAgentChat + <LpCards/> + Pipeline Ready]
     └─ <ConnectWalletModal/>           [1차]
```

## 데이터 흐름 (E2E 시퀀스)
```
User: chat 진입
  ↓
seabw Chat
  ↓ hq.createSession(profile) → sessionId
  ↓ useAgentStore.setState({ auth: { token, expiresAt } })
  ↓ chat.sendMessage(tendencyPrompt, sessionId)
  ↓
useAgentChat → ServerProxyProvider → POST /api/v1/agent/chat (SSE)
  ↓
LLM: tool_call(get_wallet_status) → registry.dispatch → result
LLM: tool_call(get_pools) → registry → result
LLM: tool_call(get_token_prices) → registry → result
LLM: tool_call(propose_lp_positions, { cards, rationale })
  ↓
proposeLpPositionsHandler:
  zod parse → generatedAt 자동 → useLpProposalStore.push(proposal)
  ↓ tool_result { status: "success" }
  ↓
LLM: "위 3장 중 1개를 선택하세요" (텍스트)
  ↓
seabw <LpCards/> — store 구독 → 카드 3장 인라인 렌더
  ↓
User: Card 2 클릭
  ↓
selectLpCard(c2):
  guardRecipe(c2) → OK
  previewRecipe(c2.recipe, ownerAddress, null) → preview
  usePipelineStore.addPendingResolved(sid, {pipelineId, recipe, summary, createdAt, previewedTick}, preview.resolved)
  ↓
chat UI: Pipeline Ready 인라인 카드 (status=pending)
  ↓
User: Execute 버튼
  ↓
executePendingPipeline(pipelineId, sessionId, ownerAddress)  [seabw local]
  ↓ markExecuting + initProgress
  ↓ executeRecipe(entry.recipe, ownerAddress, callbacks, null)
  ↓   PlatformDeps.execute(request, description) per stage
  ↓   wagmi.sendTransaction → { hash }
  ↓ markExecuted(sid, pipelineId, [txHashes])
  ↓
chat UI: success badge + tx hash 표시
  ↓
LLM: 다음 turn 에서 결과 인지 (chat message 자동 시드 — useAgentChat 내장)
```

## API/인터페이스 계약

### HQ 측 변경 (worktree feat/seabw-integration)
1. `apps/server/tools/hypurrquant-mcp-server.ts` — `propose_lp_positions` schema 추가.
2. `apps/server/docker-compose.local.yml` — `environment.CORS_ORIGIN` 에 `http://localhost:3000` 추가.
3. (변경 없음 — `/agent/tools/execute` 그대로 callTool 라우팅).

### seabw 측 신규 export
```ts
import { LpCard, LpProposal, LpProposalSchema } from "@/domains/agent/tools/propose-lp-positions";
import { useLpProposalStore } from "@/domains/agent/store/useLpProposalStore";
import { selectLpCard } from "@/domains/agent/runtime/select-lp-card";
import { guardRecipe } from "@/domains/agent/runtime/recipe-guard";
```

### HQ 기존 API (변경 없음, 정합용)
- `POST /api/v1/agent/chat` (SSE) — `useAgentChat` 가 사용.
- `POST /api/v1/agent/tool-result` — registry dispatch 후 결과 전송.
- `POST /api/v1/pipeline/resolve` — `AgentAuthGuard`, body `{ recipe }`, 응답 `{ stages, ... }`. `ensurePipelineAuthToken` 가 토큰 자동 attach.
- `POST /api/v1/agent/tools/execute` — MCP server callTool.

## 데이터 모델
- `LpProposal` / `LpCard` — §7 zod.
- `useLpProposalStore` — `{ current, push, clear }`.
- `RegistryDeps` / `RecipeAtom` / `PipelineBase` / `ResolvedPipeline` — HQ 타입 그대로 import.
- `AppState.auth` — 1차에서 추가, 변경 없음.

## 테스트 전략

### 자동
- `LpProposalSchema.safeParse` unit 5건: 3장 미만/이상, address 위반, rank 위반, 정상.
- `guardRecipe` unit 5건: atom 위반, chain 위반, amount cap 위반, length 위반, 정상.

### 수동 (S0~S5)
- **S0 (P0 데모)**: SIWE → survey → chat → LLM propose_lp_positions → 카드 3장 → 1개 클릭 → Pipeline Ready → Execute → wagmi 서명 → tx hash. **이 1개 path 가 살면 통과**.
- S1: LLM 이 propose 안 부름 → "🔄 추천 재요청" 클릭.
- S2: 서명 거부 → Pipeline 카드 markFailed("rejected").
- S3: `/pipeline/resolve` 5xx → markResolveFailed.
- S4: 다른 tool 단독 호출 — 503 없이 동작.
- S5: SIWE 만료 → 401 → AUTH_RESET + modal.

## 실패 / 에러 처리

| 시나리오 | 트리거 | 처리 |
|---|---|---|
| LpProposal zod 실패 | LLM bad args | tool_result INVALID_ARGS + 메시지 그대로 LLM 회신 → 재시도 |
| guardRecipe throw | 위험 atom/chain/amount | Pipeline 진입 차단, chat 에 에러 메시지 |
| `/pipeline/resolve` 401 | 토큰 만료 | HqUnauthorizedError → AUTH_RESET + walletModal.open (1차 패턴) |
| `/pipeline/resolve` 5xx | HQ 장애 | markResolveFailed, retry 버튼 |
| wagmi tx throw | 사용자 거부 | markFailed("rejected") |
| react 19/18 peer | mount throw | HQ packages package.json peerDep 패치 `^18 \|\| ^19` |
| getPlatformDeps not init | mount race | HqBootProvider 가 mount 즉시 호출, AgentRuntimeProvider 보다 위 |

## 롤아웃 / 롤백

### 순서
1. HQ worktree: MCP schema 추가 + docker-compose CORS 패치 → 컨테이너 재빌드/재기동 → codex schema 인식 검증.
2. seabw: pnpm-workspace.yaml 수정 → `pnpm install` → 빌드 통과.
3. seabw: tool 핸들러 복사 + buildRegistryDeps 작성 → 빌드 통과.
4. seabw: HqBootProvider + AgentRuntimeProvider 추가 → 빌드 통과.
5. seabw: chat.tsx 교체 (useAgentChat) + Pipeline Ready 카드.
6. seabw: LpCards UI + selectLpCard + guardRecipe + useLpProposalStore.
7. system prompt 갱신.
8. E2E 시연 (S0).

### 롤백
- 2차 commit 만 git revert → 1차 상태 복원.
- HQ 측: docker-compose / MCP schema commit 별도 revert.

## 관측성
- `console.info('[agent-runtime]', code, ...)` — tool 흐름.
- `console.warn('[lp-card]', code, err)` — LLM bad args / guard 실패.
- HQ 측 기존 logger 유지.

## 보안 / 권한
- 1차 SIWE 토큰 attach 그대로.
- `previewRecipe` / `executeRecipe` 는 `getPlatformDeps().signMessage` + `ensurePipelineAuthToken` (HQ 내부) 사용.
- LpCard.recipe 는 LLM 인코딩 → **HQ 가 tier 검증 안 함** → **client `guardRecipe()` 가 P0 안전망**: atom whitelist (mint/farm), chain allowlist (999/8453), amount cap ($1000), atoms length ≤ 5.
- system prompt 에서도 tier hard limits 명시 — 이중 게이트.

## 리스크 / 오픈 이슈

| ID | 항목 | 대응 |
|---|---|---|
| R1 | pnpm workspace cross-directory 첫 install 무거움 | 10분 초과 시 A1 옵션 fallback |
| R2 | react 19/18 peer 충돌 | HQ packages package.json peerDep 패치 `^18 \|\| ^19` (worktree commit) |
| R3 | `useAgentChat` message store 가 profile injection 흐름과 충돌 | sessionId 는 seabw local state, sendMessage 가 직접 받음 — 충돌 회피 |
| R4 | `setHttpBaseUrl` 호출 전 fetch 캐싱 | HqBootProvider 를 ProviderTree 최상위 가까이, mount 즉시 호출 |
| R5 | LLM 이 propose_lp_positions 형식 자주 틀림 | zod 에러 메시지 그대로 회신 + system prompt 에 예시 1건 |
| R6 | 데모 chain 에 pool 0개 | 사전 1개 확인 + mock fallback |
| R7 | wagmi 가 hyperEvm chain 객체 누락 | seabw `lib/chains.ts` 의 정의 사용, viem 호환 검증 |
| R8 | 19 peer override 시 HQ testing 깨짐 | 데모용 override, HQ PR 후속 |
| R9 | `useAgentSession.createSession` 인자 없음 → profile 누락 | S-A: seabw `hq.createSession(profile)` 사용 |
| R10 | base URL 더블 prefix `/api/v1/api/v1/...` | `NEXT_PUBLIC_HQ_ORIGIN` 별 env + setHttpBaseUrl(origin) |
| R11 | `getPlatformDeps not initialized` throw | HqBootProvider mount 즉시 init, AgentRuntimeProvider 보다 상위 |
| R12 | `useAgentPipelineModal.execute` 가 `getAccountStore()` 호출 → AccountStore 미초기화 시 throw | **B안**: hook 미사용, seabw local `executePendingPipeline` 가 `executeRecipe` 직접 호출. §11. |
| R13 | codex MCP schema 인식 실패 | 컨테이너 재기동 + 새 chat session 1회로 검증 |

오픈 이슈:
- O1: tickProvider (mint preview tick 조회) 누락 시 mint atom 의 preview tick 부정확 — P0 는 `null` 전달, LLM 이 tick 직접 채움.
- O2: pending pipeline 카드의 UX (success/fail 표시 라벨, 한국어 카피).
- O3: tx 성공 후 LLM 자동 후속 메시지 — `useAgentChat` 이 `Pipeline result: ...` 자동 시드 (확인 완료).

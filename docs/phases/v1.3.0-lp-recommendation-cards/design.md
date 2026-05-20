# 설계 - v1.3.0

## 변경 규모
**규모**: 일반 기능
**근거**:
- 신규 tool 1개 (handler + MCP schema) → API/스키마 변경 → 자동 승격으로 최소 "일반 기능".
- 신규 컴포넌트 2개 (`<LpProposalModal/>`, `<LpCard/>`) + 신규 store 1개 (`useLpProposalStore`).
- `domains/chat/chat.tsx` 1개 수정 (clear 트리거).
- 외부 시스템(HQ MCP) 변경 1건이지만 v1.2.1 2차에서 통합 토대 마련 — 본 phase 는 그 위에 1개 tool 추가.
- DB 스키마 변경 ❌ / 인증 변경 ❌ / 프로덕션 배포 영향 ❌ → "운영 리스크"는 아님.

---

## 문제 요약

AI 의 LP 추천이 자유 텍스트 — 사용자가 구조화된 선택지를 가질 수 없고 `compose_pipeline` 흐름으로 연결할 결정점이 부재. 정확히 3개의 `LpCard` 를 받는 `propose_lp_positions` tool 을 신설하고, 화면 중앙 모달로 카드를 띄워 클릭 → "I choose option N" user 메시지 자동 재전송 → AI 가 `compose_pipeline` tool_call 발행 → 기존 wagmi 서명 흐름 진입.

> 상세: [README.md](README.md) 참조.

## 접근법

1. **신규 tool 1개 (`propose_lp_positions`)** — `args: { proposal: LpProposal }`. browser handler 가 args 만 검증하고 `useLpProposalStore.addProposal(sessionId, proposal)` 호출 후 즉시 `{ status: 'success' }` 반환 (no async work, no RPC).
2. **`<LpProposalModal/>` (store-watch 패턴)** — provider 트리 최상단에 1회 mount. `useLpProposalStore` 의 현 sessionId proposal 을 구독 → 존재 시 자동 오픈, 없으면 unmount.
3. **카드 클릭 → AI 매개 실행** — `useAgentChat().sendMessage("I choose option <N>", sessionId)` 호출 + 직후 `clearProposal(sessionId)`. AI 는 system prompt 가이드라인을 따라 해당 카드의 `recipe` 를 인지하고 `compose_pipeline` tool_call 발행 → 기존 `PipelinePreviewModal` 흐름 진입.
4. **새 user 메시지 → 카드 자동 제거** — `chat.tsx` 의 메시지 전송 직전 `clearProposal(sessionId)`.
5. **system prompt 갱신** — "LP 추천 시 반드시 `propose_lp_positions` 사용. 정확히 3장. rank 1=최고 추천. tier 한도 가드. 카드 ID 가 메시지 내에 보관되어 있으면 'I choose option N' 메시지 수신 시 N 번째 카드의 recipe 로 compose_pipeline 실행."

## 대안 검토

### A. 카드 → 실행 트리거 방식

| 방식 | 장점 | 단점 | 선택 |
|---|---|---|---|
| A1. 핸들러가 `compose_pipeline` 직접 호출 (LLM 왕복 0회) | 빠름, 결정적 | LLM 컨텍스트에 "선택" 이 안 남음, system prompt 다이얼로그 흐름 깨짐 | ❌ |
| **A2. `useAgentChat.sendMessage("I choose option N")` 재전송 (LLM 매개)** | 대화 맥락 일관, system prompt 로 행동 통제 가능, AI 가 후속 설명 가능 | LLM 왕복 1회 (~수초 지연), LLM 결정성 의존 | ✅ |
| A3. 새 tool `confirm_lp_selection({selectedRank})` 추가 | 명시적 contract | tool 1개 더 만드는 비용, LLM 이 결국 compose_pipeline 호출해야 → 결국 A2 와 같음 | ❌ |

**선택 이유 (A2)**: 사용자가 사전 결정. 데모에서 "AI 가 받아서 처리하는" 자연스러움이 핵심 가치.

### B. 모달 트리거 패턴

| 방식 | 장점 | 단점 | 선택 |
|---|---|---|---|
| B1. HQ `useAgentPipelineModal` 처럼 hook.execute() 호출 | 기존 패턴 일관 | handler 가 hook 메서드를 부를 수 없음 (handler 는 등록 시점 1회 생성) | ❌ |
| **B2. store-watch 패턴 (`useLpProposalStore` 구독 → 자동 오픈)** | handler → store action 만 호출, UI 가 reactive | 기존 패턴과 살짝 다름 (문서화 필요) | ✅ |
| B3. handler 가 콜백 주입받기 (`deps.onLpProposal`) | 명시적 contract | 모달 한 곳에서만 쓸 콜백을 deps 에 박는 게 부자연스러움 | ❌ |

**선택 이유 (B2)**: handler 는 순수 함수 유지가 자연스럽고, store 는 이미 sessionId-scoped 패턴 존재 (HQ `createPipelineStore`).

### C. LpCard 스키마 SSOT

| 방식 | 장점 | 단점 | 선택 |
|---|---|---|---|
| C1. seabw zod 만 — HQ MCP 는 `z.unknown()` | drift 0 (어차피 LLM 이 LpCard 형태로만 생성) | HQ MCP 서버에서 검증 안 됨 → 잘못된 args 가 browser 까지 도달 | ❌ |
| **C2. zod schema 를 seabw 에 정의, HQ MCP 측은 같은 zod 를 import 하지 않고 동일한 JSON Schema 를 수동 미러** | HQ MCP 가독성, drift 위험 작음 (필드 적음) | 수동 동기 필요 | ✅ |
| C3. `@hq/core` 에 LpCard 타입 박고 양쪽 import | drift 0 | 본 phase 가 HQ 패키지 수정 — OOS 위반 | ❌ |

**선택 이유 (C2)**: HQ MCP 변경은 최소. seabw 측 zod 가 진짜 검증의 SSOT. drift 는 PR 시 양쪽 grep 으로 확인.

## 기술 결정

- **store 패턴**: `create<State & Actions>(...)` zustand 단일 store (HQ `createPipelineStore` 시그니처 따름). sessionId-keyed `Record<string, ProposalEntry>` 구조 — 멀티 세션 대비 (현재 단일이지만 확장 비용 0).
- **handler factory**: `createProposeLpPositionsHandler({ getLpProposalStore }: Deps)` — 테스트 시 store mock 가능.
- **모달 마운트 위치**: `apps/web/src/components/providers.tsx` 의 트리 안에 `<LpProposalModalHost/>` mount — chat stage 외에서도 store 변화 시 표시되도록 (실제로는 chat stage 에서만 트리거되지만 가드는 store 에서).
- **카드 ID**: handler 가 `crypto.randomUUID()` 부여 (LLM 이 안 줘도 OK). 모달에서 ID 표시는 안 하지만 sendMessage 메시지에 보관.
- **"I choose option N" 메시지 포맷**: `I choose option ${rank}.` (영어 고정). system prompt 에 동일 토큰 박아서 AI 가 인식.
- **시각 마킹**: 사용자가 직접 입력한 메시지인지, 시스템이 자동 보낸 메시지인지 구분되어야 — 메시지에 메타데이터 (`role: 'user', kind: 'card-selection'`) 추가 또는 prefix `[Selection] I choose option 1`. **선택**: prefix `[Selection]` — chat UI 가 한 줄 변경으로 처리 가능.
- **zod 스키마**:
  - `cards: z.tuple([LpCardSchema, LpCardSchema, LpCardSchema])` — 정확히 3개 타입 강제.
  - `LpCardSchema.recipe` 는 `z.array(z.unknown())` 로 RecipeAtom 검증은 skip — packages/core 의 RecipeAtom 이 union 이라 정확한 검증은 compose_pipeline 단계에서. 본 phase 는 형식만.

---

## 범위 / 비범위

### 범위 (In Scope)
- `apps/web/src/domains/agent/tools/propose-lp-positions/{schema,handler,index}.ts` 신규.
- `apps/web/src/domains/agent/tools/index.ts` registry 등록 1줄 추가.
- `apps/web/src/domains/agent/stores/use-lp-proposal-store.ts` 신규.
- `apps/web/src/domains/chat/lp-proposal-modal.tsx` 신규 (`<LpProposalModalHost/>` + `<LpCard/>` 포함).
- `apps/web/src/components/providers.tsx` modal host mount 1줄 추가.
- `apps/web/src/domains/chat/chat.tsx` — `onSend` 직전 `clearProposal` 호출.
- HQ worktree `apps/server/tools/hypurrquant-mcp-server.ts` — `propose_lp_positions` 스키마 1개 추가.
- `docs/seabw-system-prompt.md` — "LP 추천 규약" 절 추가.

### 비범위 (Out of Scope)
(README.md 참조 — 동일)

## 가정 / 제약

### 가정
- v1.2.1 2차 완료: `@hq/react/agent` workspace link, `BrowserToolRegistry`, `usePipelineStore`, `PipelinePreviewModal`, `executeRecipe`, `useAgentChat.sendMessage` 모두 동작.
- `useAgentChat` 가 외부에서 `sendMessage(text, sessionId)` 를 노출 (Explore 확인).
- HQ MCP server 가 새 tool 추가 시 핫리로드 가능 (또는 worktree 재기동 수동).
- LLM(Codex/Anthropic)이 `propose_lp_positions` tool 을 system prompt 가이드를 따라 호출 (시연 데이터로 1차 검증).
- 데모 환경 단일 세션 — `useLpProposalStore` 가 sessionId 1개만 다뤄도 OK.

### 제약
- 본 phase 에서 `@hq/react/agent` 패키지 자체 수정 금지.
- HQ apps/web 의 BrowserToolRegistry 자체 수정 금지 (등록 1줄만).
- 의존성 추가 0 (zustand 는 이미 HQ packages 경유 import 가능).

## 아키텍처 개요

```
[chat stage 진입 후]
사용자: "내 성향 맞는 LP 추천해줘"
   ↓
[useAgentChat.sendMessage]
   ↓
[HQ /agent/chat SSE]
   ↓
[Codex LLM] (system prompt 가이드에 따라)
   ↓ tool_call: propose_lp_positions({proposal: LpProposal})
[useAgentChat 의 onToolCall]
   ↓
[BrowserToolRegistry.execute('propose_lp_positions', args, ctx)]
   ↓
[proposeLpPositionsHandler]
   ├─ zod 검증 (정확히 3장)
   ├─ useLpProposalStore.addProposal(sessionId, proposal)
   └─ return { status: 'success' }
   ↓ tool_result 회신 (LLM 은 후속 텍스트 가능)
[<LpProposalModalHost/>] (store 구독)
   ↓ 자동 오픈
[유저: 카드 2번 클릭]
   ↓
[onSelect(rank=2)]
   ├─ useAgentChat.sendMessage("[Selection] I choose option 2.")
   ├─ useLpProposalStore.clearProposal(sessionId)
   └─ 모달 닫힘
   ↓
[Codex LLM] (system prompt 가이드)
   ↓ tool_call: compose_pipeline({recipe: card[2].recipe})
[HQ packages/react/agent 의 기존 compose_pipeline 흐름]
   ↓
[<PipelinePreviewModal/>] 자동 오픈
   ↓ 유저 승인
[wagmi 서명 → 온체인 LP 진입]
```

```
[유저: 카드 선택 안 하고 새 메시지 입력]
chat.tsx onSend()
   ├─ useLpProposalStore.clearProposal(sessionId)
   └─ useAgentChat.sendMessage(input)
   → 모달 즉시 사라짐
```

## 데이터 흐름
위 아키텍처 다이어그램 참조. 추가 시퀀스 없음.

## API/인터페이스 계약

### MCP tool 스키마 (`hypurrquant-mcp-server.ts` 신규)

```ts
const LpCardArgsSchema = z.object({
  rank: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  protocol: z.string(),
  chainId: z.number(),
  pair: z.object({
    base: TokenRefSchema,
    quote: TokenRefSchema,
  }),
  feeTier: z.number().optional(),
  poolAddress: z.string(),
  metrics: z.object({
    apr: z.number(),
    apr7dAvg: z.number().optional(),
    tvlUsd: z.number(),
    volume24hUsd: z.number().optional(),
    ilRisk: z.enum(['low', 'medium', 'high']),
  }),
  position: z.object({
    suggestedAmountUsd: z.number(),
    priceRange: z.object({
      lower: z.number(),
      upper: z.number(),
      unit: z.enum(['price', 'tick']),
    }).optional(),
    tokenSplit: z.object({ base: z.number(), quote: z.number() }).optional(),
  }),
  reasoning: z.object({
    fitForTier: z.string(),
    pros: z.array(z.string()).max(3),
    cons: z.array(z.string()).max(3),
    tierAlignment: z.enum(['match', 'stretch', 'warning']),
  }),
  recipe: z.array(z.unknown()),  // RecipeAtom[] (compose_pipeline 가 검증)
  estimatedGasUsd: z.number().optional(),
});

server.tool(
  'propose_lp_positions',
  'Propose exactly 3 LP position candidates to the user. The user will see a modal with 3 cards and select one. Use this whenever the user asks for LP recommendations. rank=1 is your top recommendation; 2 and 3 are alternatives.',
  {
    proposal: z.object({
      cards: z.tuple([LpCardArgsSchema, LpCardArgsSchema, LpCardArgsSchema]),
      rationale: z.string(),
    }),
  },
  (args) => callTool('propose_lp_positions', args),
);
```

### Browser handler 시그니처

```ts
// apps/web/src/domains/agent/tools/propose-lp-positions/handler.ts
export function createProposeLpPositionsHandler(deps: {
  lpProposalStore: typeof useLpProposalStore;
}): BrowserToolHandler {
  return async (args, context) => {
    const parsed = LpProposalArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { status: 'error', code: 'INVALID_ARGS', message: parsed.error.message };
    }
    const proposalWithIds = withCardIds(parsed.data.proposal);
    deps.lpProposalStore.getState().addProposal(context.sessionId, proposalWithIds);
    return { status: 'success', data: { cardIds: proposalWithIds.cards.map(c => c.id) } };
  };
}
```

## 데이터 모델 / 스키마

### `LpCard` / `LpProposal` (seabw zod, SSOT)

`apps/web/src/domains/agent/tools/propose-lp-positions/schema.ts`:

```ts
export const TokenRefSchema = z.object({
  symbol: z.string(),
  address: z.string(),
  decimals: z.number(),
  logoUri: z.string().optional(),
});

export const LpCardArgsSchema = z.object({ /* see API 섹션 */ });
export const LpProposalArgsSchema = z.object({
  proposal: z.object({
    cards: z.tuple([LpCardArgsSchema, LpCardArgsSchema, LpCardArgsSchema]),
    rationale: z.string(),
  }),
});

// 핸들러가 ID 부여 후 store 보관용
export type LpCard = z.infer<typeof LpCardArgsSchema> & { id: string };
export type LpProposal = {
  cards: [LpCard, LpCard, LpCard];
  rationale: string;
  generatedAt: number;
};
```

### `useLpProposalStore`

```ts
type ProposalEntry = LpProposal;

interface LpProposalState {
  proposals: Record<string, ProposalEntry>;   // sessionId -> proposal
}

interface LpProposalActions {
  addProposal: (sessionId: string, proposal: LpProposal) => void;   // 기존 있으면 교체
  clearProposal: (sessionId: string) => void;
  selectProposal: (sessionId: string, rank: 1 | 2 | 3) => LpCard | null;
}

export const useLpProposalStore = create<LpProposalState & LpProposalActions>(...);
```

## 테스트 전략

해커톤 — 자동 테스트 최소화. 수동 시연 우선.

### 자동
- `propose-lp-positions/handler.test.ts` — args 검증 happy / 카드 개수 ≠ 3 / store add 호출 1건.
- `use-lp-proposal-store.test.ts` — add/clear/select 기본 reducer 동작.

### 수동
- **S1. 행복 경로**: chat 진입 → "LP 추천" → 모달 자동 오픈 → 카드 2 클릭 → 모달 닫힘 → 자동 메시지 노출 → `compose_pipeline` 동작 → `PipelinePreviewModal` 표시 → 서명 → 온체인.
- **S2. 새 메시지로 카드 제거**: 추천 후 카드 선택 안 하고 다른 메시지 입력 → 모달 즉시 사라짐.
- **S3. 카드 개수 위반**: 강제로 4개 또는 2개 args → handler 가 INVALID_ARGS 응답 → AI 가 재시도하거나 텍스트로 fallback.
- **S4. tier 한도 위반**: preservation tier 에 degen 풀 1장 — system prompt 가드가 막는지 확인 (실패 시 prompt 보강).
- **S5. AI 가 selection 메시지 무시**: "I choose option 2" 보냈는데 LLM 이 다른 답 → prompt 보강 또는 fallback UI 추가 결정.

## 실패 / 에러 처리

| 시나리오 | 처리 |
|---|---|
| handler args INVALID | tool_result `{status: 'error', code: 'INVALID_ARGS', message}` 회신 → LLM 후속 텍스트 응답. UI 변화 없음. |
| store 가 이미 같은 sessionId proposal 보유 | `addProposal` 이 무조건 교체. 이전 카드 폐기. |
| 카드 클릭 직후 `sendMessage` 실패 | 토스트 + 카드 모달 재오픈 (clear 롤백). |
| `compose_pipeline` 단계에서 calldata 빌드 실패 | 기존 `PipelinePreviewModal` 의 에러 표시. 본 phase 외 책임. |
| LLM 이 "I choose option N" 받고도 compose_pipeline 안 부름 | 데이터 부족 시 LLM 이 텍스트로 답 — 받아들임. system prompt 보강이 1차 대응. |
| 카드 클릭 시 sessionId 가 없음 (race) | 모달이 store 구독이므로 이론상 발생 X. 가드 1줄로 차단. |

## 롤아웃 / 롤백
단일 PR. 회귀 시 revert. 데이터 마이그레이션 없음. HQ MCP 변경은 worktree `feat/seabw-integration` 의 1개 파일 + seabw web 변경. compose 재기동만으로 적용.

## 관측성
- handler 진입/검증 실패/store push 시 `console.info('[lp-proposal]', ...)`.
- 카드 클릭 시 `console.info('[lp-proposal] selected', { rank, cardId })`.
- 모달 자동 오픈 시 `console.info('[lp-proposal] modal opened', { sessionId })`.

## 성능 / 스케일
N/A: 단일 세션 데모. proposal 1개만 store 에 보관, 카드 3장 렌더.

## 보안 / 권한
N/A: 신규 인증/권한 변경 없음. `propose_lp_positions` 도 다른 tool 과 같은 토큰 가드 안에서 동작 (v1.2.1 1차 SIWE).

## 리스크 / 오픈 이슈

| ID | 항목 | 영향 | 대응 |
|---|---|---|---|
| R1 | LLM 이 system prompt 무시하고 자유 텍스트로 LP 답변 | 모달이 안 뜸 — 데모 실패 | prompt 에 강한 지시문 + 첫 LP 질문에 few-shot 예시 1개 |
| R2 | LLM 이 `propose_lp_positions` 후 카드 ID 모름 → "I choose option N" 받아도 어느 카드인지 매핑 못 함 | compose_pipeline 잘못된 recipe | rank 기준 매핑 (LLM 메모리에 카드 3개 args 가 있음) — system prompt 에 명시 |
| R3 | sendMessage 가 외부에 노출 안 됨 (v1.2.1 2차 통합 결과에 따라) | 카드 클릭 → 자동 메시지 불가 | v1.2.1 2차 통합 후 확인. 안 되면 `chat.tsx` 가 직접 fetch + 메시지 인서트 |
| R4 | RecipeAtom 스키마가 v1.2.1 2차 시점에 바뀜 | LpCard.recipe 가 invalid | `recipe` 는 `z.unknown()` 으로 검증 skip — compose_pipeline 단계에서 거름 |
| R5 | `<LpProposalModalHost/>` 가 `<PipelinePreviewModal/>` 과 동시 표시 | z-index 충돌 | LP 모달이 먼저 닫힘 (카드 클릭 시점에) → 동시 노출 케이스 없음. z-index 는 동일 레벨로 OK |
| R6 | HQ MCP 변경이 다른 통합 컨테이너 영향 | 저 | worktree 격리 (v1.2.1 1차와 동일 정책) |

오픈 이슈:
- O1: 카드 클릭 시 prefix `[Selection]` 가 LLM 토큰 캐시를 깰 수 있음 — 첫 시연 후 결정. 깨면 prompt 에 prefix 무시 지시 추가.
- O2: AI 가 propose_lp_positions 호출 후 자체 텍스트 응답을 같이 보낼 경우, 모달 + 텍스트가 동시 표시 — 텍스트도 chat 흐름에 정상 표시되도록 (기존 stream 동작 그대로).

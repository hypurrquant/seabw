# Step 16: chat.tsx 재작성 (useAgentChat + LpCards + Pipeline Ready + selectLpCard + guardRecipe + executePendingPipeline + dev-only)

## 메타데이터
- **난이도**: 🔴
- **롤백 가능**: ✅ (git revert)
- **선행 조건**: Step 13, 14, 15

## 1. 구현 내용

### A. `apps/web/src/domains/agent/runtime/recipe-guard.ts`
- design.md §10 그대로.
- ALLOWED_ATOMS = {mint, farm}.
- CHAIN_ALLOWLIST = {999, 8453}.
- MAX_AMOUNT_USD = 1000.
- max atoms length 5.
- guardRecipe(card: LpCard): void — throw on violation.

### B. `apps/web/src/domains/agent/runtime/select-lp-card.ts`
- design.md §9 그대로.
- guardRecipe → previewRecipe(recipe, owner, null) → usePipelineStore.addPendingResolved(sid, base, resolved).
- pipelineId = `lp-card-${card.id}-${Date.now()}`.

### C. `apps/web/src/domains/agent/runtime/execute-pipeline.ts`
- design.md §11 그대로.
- 9 callback 필드 모두.
- txHashes 배열 수집.
- onComplete → markExecuted, onError → markFailed, finally → clearProgress.

### D. `apps/web/src/domains/chat/lp-cards.tsx`
- `useLpProposalStore` 구독.
- proposal null 이면 null.
- 3 카드 grid (`grid-cols-1 lg:grid-cols-3`).
- 각 카드: rank badge / protocol / pair (base–quote) / APR / TVL / IL risk chip / tier alignment color / fitForTier / pros[0..2] / cons[0..2] / suggestedAmountUsd / "Choose" 버튼.
- "Choose" → `onSelect(card)` callback.

### E. `apps/web/src/domains/chat/pipeline-ready-card.tsx`
- props: `pipelineId: string`, `sessionId: string`, `ownerAddress: 0x`.
- `usePipelineStore((s) => s.pipelines[pipelineId])` 구독.
- status 분기:
  - `pending` → summary + "Execute" 버튼 → click → `executePendingPipeline(pipelineId, sessionId, ownerAddress)`.
  - `executing` → progress bar (`usePipelineStore((s) => s.progress[pipelineId])`).
  - `executed` → success badge + txHashes 표시 (각 hash 를 chain explorer link).
  - `failed`/`resolve_failed`/`rejected` → 에러 메시지.

### F. `apps/web/src/domains/chat/chat.tsx` 재작성
- 자체 SSE 흐름 (`chatStream`, `submitToolResult` import) 모두 제거.
- `useAgentChat({ /* options */ })` 진입점.
- sessionId 는 `useState<string | null>(null)`.
- chat 진입 시 effect:
  ```ts
  useEffect(() => {
    if (sessionId) return;
    if (state.auth.status !== "authed") return;
    if (!state.answers || !state.tier) return;
    (async () => {
      const sid = await hq.createSession({ answers: state.answers!, tier: state.tier! });
      setSessionId(sid);
      const first = buildTendencyPrompt(state.answers!, state.tier!);
      chat.sendMessage(first, sid);
    })().catch((e) => {
      // HqUnauthorizedError → AUTH_RESET + modal (1차 패턴)
      ...
    });
  }, [state.auth.status, state.answers, state.tier]);
  ```
- 메시지 구독: `useAgentStore((s) => s.sessionStateById?.[sessionId]?.messages ?? [])`.
- 카드 렌더: `<LpCards onSelect={(c) => { const pid = selectLpCard(c, { ownerAddress, sessionId }); setLocalPipelineIds((p) => [...p, pid]); }} />`.
- **session 필터는 PipelineStore entry 의 sessionId 필드 의존하지 않음**. 대신 chat 컴포넌트 local state 로 추적:
  ```ts
  const [localPipelineIds, setLocalPipelineIds] = useState<string[]>([]);
  // selectLpCard 가 pipelineId 반환하도록 시그니처 수정:
  //   selectLpCard(card, ctx): Promise<string>
  ```
- pending pipeline 렌더: `localPipelineIds.map((pid) => <PipelineReadyCard key={pid} pipelineId={pid} sessionId={sessionId!} ownerAddress={ownerAddress!} />)`.
- header: "← Back to report" + dev-only "🔄 추천 재요청" (`NODE_ENV !== "production"`).
- 401 에러 처리: chat.sendMessage 가 throw 하면 catch 후 dispatch AUTH_RESET + walletModal.open().

### G. unit (LpCards UI 제외, runtime 만)
- `guardRecipe` 5건 (mint OK, atom 위반, chain 위반, amount cap 위반, length 위반).
- `selectLpCard` mock previewRecipe 로 정상/실패 2건.

## 2. 완료 조건

### 16A — runtime (코드 가능성 확인)
- [ ] recipe-guard.ts / select-lp-card.ts / execute-pipeline.ts 신규
- [ ] `selectLpCard` 시그니처가 `Promise<string>` (pipelineId 반환)
- [ ] guardRecipe 5 unit + selectLpCard 2 unit 통과
- [ ] `pnpm typecheck` 통과

### 16B — UI / 통합
- [ ] lp-cards.tsx / pipeline-ready-card.tsx 신규
- [ ] chat.tsx 재작성 (자체 SSE 제거 + useAgentChat + LpCards + Pipeline Ready 통합 + localPipelineIds 추적)
- [ ] dev-only 추천 재요청 버튼
- [ ] 401 처리
- [ ] `pnpm typecheck` 통과
- [ ] `pnpm build` 통과

## Scope
### 수정 파일
- `apps/web/src/domains/chat/chat.tsx`

### 신규 파일
- `apps/web/src/domains/agent/runtime/{recipe-guard, select-lp-card, execute-pipeline}.ts`
- `apps/web/src/domains/chat/{lp-cards, pipeline-ready-card}.tsx`
- 위 unit 파일들

### Side Effect 위험
- v1.2.0 의 자체 SSE 로직과 strong coupling 된 코드 (`submitToolResult` 호출 등) — chat.tsx 외에는 없는지 grep 으로 확인.
- React 19 strict mode 의 double-effect — sessionId 생성을 mount 1회로 가드.

## FP/FN
### FP
- 없음.

### FN
- (해결) pipeline-ready-card 의 session 필터는 PipelineStore entry 필드 의존하지 않음. chat 컴포넌트 local state (`localPipelineIds`) 로 추적 — selectLpCard 가 pipelineId 반환.

검증 통과: ✅

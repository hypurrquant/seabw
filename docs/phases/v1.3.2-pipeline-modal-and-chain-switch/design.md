# 설계 - v1.3.2

## 접근법

### 1. UI: LP 카드 클릭 → 모달
- `lp-cards.tsx` 의 카드 컴포넌트에 `onClick` 추가.
- 클릭 시:
  1. 새 `useLpExecutionModal()` store/hook 에 `{ card }` set → 모달 open.
  2. 모달 mount 시 useEffect 로 `composeAndResolvePipeline(card.recipe, sessionId)` 호출 → `pipelineId` 획득 → `usePipelineStore` 에 entry 가 생긴 상태.
- AI 의 `compose_pipeline` tool 호출은 여전히 동작 (store update) 하나, **채팅에 Pipeline Ready inline 카드는 더 이상 렌더하지 않음**.

### 2. 모달 컴포넌트 (`pipeline-execution-modal.tsx`)
- HQ `PipelineExecutionModal` phase 모델 차용:
  - `idle` (resolve 진행/대기) → "준비 중..." 표시.
  - `executing` → step별 progress (현재/총 step).
  - `complete` → tx hash 목록 + 닫기 버튼.
  - `error` → 에러 메시지 + Retry 버튼 (단순화: Recovery 패널 없음).
- 베이스: 새 `components/ui/modal-container.tsx` (backdrop + center card + esc close). 기존 `connect-wallet-modal.tsx` 와 동일한 톤 (`bg-[color:var(--color-surface)]`, `border-[color:var(--color-border)]`).
- backdrop 클릭 close: idle/complete/error 에서만 허용. executing 중에는 차단.

### 3. 체인 자동 전환
- `execute-pipeline.ts` 의 `executePendingPipeline()` 진입부에서 `wagmi/react` `useSwitchChain` 의 `switchChainAsync` 호출 → 다만 hook 은 컴포넌트 안에서만 호출 가능. 따라서:
  - hook 결과는 모달 컴포넌트가 가지고, prop 으로 `executePendingPipeline` 에 콜백 주입.
  - 또는 `getWagmiConfig()` + `switchChain` (core action) 사용 — 후자가 훨씬 깔끔. 채택.
- 흐름:
  1. `executePendingPipeline()` 진입.
  2. `getAccount(config).chainId !== 999` 이면 `switchChain(config, { chainId: 999 })` 호출.
  3. 거부 시 throw → 모달 error phase.

### 4. Pipeline Ready inline 카드 제거
- `chat.tsx` 에서 pipeline 관련 inline 컴포넌트 mount 부분 제거 (LP 카드는 유지).
- 컴포넌트 파일 `pipeline-ready-card.tsx` 자체는 일단 보존 (롤백 안전성). 다음 phase 에서 정리.

## 버린 대안
- HQ 의 PipelineExecutionModal 전체 이식: `RecoveryPanel`, `usePresentAppError`, `getErrorMeta` 등 의존성 폭이 너무 크고 seabw 단일 chain/단일 atom(mint) 에 과대 투자.
- wagmi React hook 만 사용해서 chain 전환: 콜백 주입 코드가 늘어남. core action 으로 충분.

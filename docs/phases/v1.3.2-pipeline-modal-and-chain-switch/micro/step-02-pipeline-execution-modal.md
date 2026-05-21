# Step 02: PipelineExecutionModal + store hook

## 메타데이터
- **난이도**: 🟡
- **선행 조건**: Step 01

## 구현 내용
- `domains/chat/pipeline-execution-modal.tsx` 신규.
- 내부 상태 hook `useLpExecutionModal()` (zustand 또는 단순 React Context):
  - `{ card: LpCard | null, pipelineId: string | null, open(card), close() }`
- 모달 mount 시 `composeAndResolve(card.recipe, sessionId, owner)` 호출 → `pipelineId` set.
- `usePipelineStore` 의 entry status 로 phase 도출:
  - 없음/`pending` → idle
  - `executing` → executing (`progress` 사용)
  - `executed` → complete (`txHashes`)
  - `failed`/`resolve_failed`/`rejected` → error
- Execute 버튼 → Step 03 의 `executePendingPipeline` 호출.
- 닫기 정책: executing 중에는 backdrop close 차단.

## 완료 조건
- [ ] 카드 클릭 시 모달 등장
- [ ] resolve 중 "준비 중..." 표시
- [ ] resolve 완료 시 Execute 버튼 활성화
- [ ] executing 중 progress bar 표시
- [ ] complete 시 tx hash 목록 + 확인 버튼
- [ ] error 시 메시지 + Retry 버튼

## Scope
### 신규 생성
- `apps/web/src/domains/chat/pipeline-execution-modal.tsx` — phase 별 UI + store hook
- `apps/web/src/domains/chat/use-lp-execution-modal.ts` — modal open/close store

### 수정 대상
- `apps/web/src/domains/chat/lp-cards.tsx` — 카드에 onClick 핸들러 추가 (open(card))
- `apps/web/src/domains/chat/chat.tsx` — `<PipelineExecutionModal />` mount

# Step 14: propose_lp_positions handler + LpProposalSchema + useLpProposalStore + zod unit

## 메타데이터
- **난이도**: 🟡
- **롤백 가능**: ✅
- **선행 조건**: Step 12 (zustand 설치 필요)

## 1. 구현 내용

### A. `apps/web/src/domains/agent/tools/propose-lp-positions.ts`
- design.md §7 의 LpProposalSchema 그대로.
- TokenRefSchema, LpCardSchema, LpProposalSchema export.
- `createProposeLpPositionsHandler(deps)` factory — zod parse + generatedAt 자동 채움 + push.
- 에러 시 issues 의 path/message 를 그대로 회신.

### B. `apps/web/src/domains/agent/store/useLpProposalStore.ts`
```ts
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

### C. unit tests
`apps/web/src/domains/agent/tools/__tests__/propose-lp-positions.test.ts`:
1. 정상 3장 + generatedAt 누락 → handler 가 generatedAt 자동 채움 + push 호출 + tool_result success
2. 2장 만 → tool_result error code INVALID_ARGS + 메시지에 `cards`
3. 4장 → tool_result error
4. rank 4 → tool_result error (rank: ...)
5. recipe 빈 배열 → tool_result error

`apps/web/src/domains/agent/store/__tests__/useLpProposalStore.test.ts`:
- push → current 갱신
- clear → current null

### D. (확인용) LpCardSchemaMcp 와 LpCardSchema 필드 매핑 한 표를 코드 주석에 남김 (drift 방지).

## 2. 완료 조건
- [ ] propose-lp-positions.ts 신규
- [ ] useLpProposalStore.ts 신규
- [ ] 5개 zod unit + 2개 store unit 작성 + 통과
- [ ] `pnpm typecheck` 통과
- [ ] `pnpm test` 관련 케이스 통과

## Scope
### 수정 파일
- 없음

### 신규 파일
- `apps/web/src/domains/agent/tools/propose-lp-positions.ts`
- `apps/web/src/domains/agent/store/useLpProposalStore.ts`
- `apps/web/src/domains/agent/tools/__tests__/propose-lp-positions.test.ts`
- `apps/web/src/domains/agent/store/__tests__/useLpProposalStore.test.ts`

### Side Effect 위험
- 없음.

## FP/FN
### FP
- 없음.

### FN
- HQ MCP server 의 LpCardSchemaMcp 와 seabw LpCardSchema 가 drift → Step 11 와 같은 필드 표를 코드 주석으로 양쪽에 박음.

검증 통과: ✅

# Step 04: LpProposalModalHost + LpCard UI + Providers mount

## 메타데이터
- **난이도**: 🟠 중간
- **롤백 가능**: ✅ (UI 파일 삭제 + providers.tsx 1줄 revert)
- **선행 조건**: Step 02 (store 구독 필요)

---

## 1. 구현 내용 (design.md 기반)

- `apps/web/src/domains/chat/lp-proposal-modal.tsx` 신규
  - `<LpProposalModalHost/>` — `useLpProposalStore` 구독, 현 sessionId proposal 존재 시 모달 표시
    - sessionId 는 `AppState.auth.ownerAddress` 또는 chat 에서 사용 중인 sessionId — 후자가 정확. 본 phase 에서는 `useAgentChat().sessionId` getter 또는 store/context 에서 조회. (v1.2.1 2차 결과에 따라 정확한 경로 확정)
  - `<LpCard/>` — 개별 카드 렌더
    - 헤더: protocol + pair (base/quote 심볼) + fee tier 배지
    - KPI bar: APR (%), TVL ($), IL risk 컬러 배지
    - reasoning: fitForTier 1줄 + pros (✓ 리스트) + cons (✗ 리스트)
    - tierAlignment 배지: match=초록, stretch=노랑, warning=빨강
    - rank 1 카드는 border/배경/배지로 강조 ("AI 최고 추천")
    - 풋: estimatedGasUsd (옵션) + "Choose" 버튼
  - 카드 클릭 핸들러는 컴포넌트 prop 으로 받음 (`onSelect: (rank: 1|2|3) => void`) — Step 05 에서 wiring
  - 모달 닫기 X 버튼 → `clearProposal(sessionId)` (보류 의미)
  - 화면 중앙 fixed positioning (Tailwind `fixed inset-0` + `flex items-center justify-center`, 백드롭 black/60)
- `apps/web/src/components/providers.tsx` 수정 — 트리 안에 `<LpProposalModalHost/>` mount

## 2. 완료 조건 ⚠️

- [ ] `lp-proposal-modal.tsx` 가 `LpProposalModalHost` + `LpCard` 2 컴포넌트 export
- [ ] `LpProposalModalHost` 가 store 미존재 시 `null` 반환, 존재 시 모달 렌더 (수동 — devtools 로 store 강제 push 후 모달 확인)
- [ ] 모달이 화면 중앙 fixed (devtools elements 검사 — `position: fixed`, 백드롭 layer 존재)
- [ ] 카드 3장이 rank 순서로 렌더 (rank 1 강조 시각화)
- [ ] 각 카드에 protocol/pair/feeTier/APR/TVL/IL risk/pros/cons/tierAlignment 모두 표시
- [ ] 백드롭 클릭 또는 X 버튼 → `clearProposal` 호출 → 모달 닫힘
- [ ] `providers.tsx` 에 `<LpProposalModalHost/>` mount (`grep "LpProposalModalHost" providers.tsx` 1 hit)
- [ ] `pnpm typecheck` + `pnpm build` 통과
- [ ] `console.info('[lp-proposal] modal opened'`, `'[lp-proposal] modal closed'` 로그 박힘 (DoD N7)

## 3. 롤백 방법

- `rm apps/web/src/domains/chat/lp-proposal-modal.tsx`
- `providers.tsx` 의 host mount 1줄 revert
- 영향 범위: store 변화 시 모달 안 뜸 — handler 는 동작하지만 사용자가 카드 못 봄.

---

## Scope

### 수정 대상 파일
```
apps/web/src/components/
└── providers.tsx       # 수정 - <LpProposalModalHost/> mount 1줄
```

### 신규 생성 파일
```
apps/web/src/domains/chat/
└── lp-proposal-modal.tsx    # 신규 - Host + Card 2개 컴포넌트
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| Step 02 `useLpProposalStore` | import | 구독 |
| HQ `useAgentChat` (sessionId getter) | import | 현재 sessionId 조회 — 정확한 API 는 v1.2.1 2차 결과 확인 |
| `@/components/ui` (`Card`, `Button`, `Pill`) | import | 기존 primitives 재사용 |
| Step 01 `LpCard` 타입 | import | prop 타입 |

### Side Effect 위험
- **risk 1**: providers 트리 mount 위치가 chat stage 외에서도 active — store 변화만 트리거이므로 chat stage 외에서는 비활성 (store 에 proposal 없음). OK.
- **risk 2**: `useAgentChat` 의 sessionId 가 매 chat stage 진입 시 변경 — `<LpProposalModalHost/>` 가 매번 다른 sessionId 구독해야 함. useEffect dependency 정확히.
- **risk 3**: `<PipelinePreviewModal/>` (v1.2.1 2차) 과 동시 표시 가능성 — z-index 동일 레벨 (`z-50`). LP 모달은 카드 클릭 시점에 닫히므로 race 가 발생해도 1 frame 만.

### 참고할 기존 패턴
- HQ `packages/react/agent/hooks/useAgentPipelineModal.ts` — 모달 hook 시그니처 (참고만, 본 phase 는 store-watch 패턴이라 다름).
- `apps/web/src/components/ui.tsx` — Card/Button/Pill primitives.

---

## FP/FN 검증

### False Positive (과잉)
| Scope 항목 | 구현 내용 근거 | 판정 |
|-----------|---------------|------|
| `lp-proposal-modal.tsx` | Host + Card 2 컴포넌트 | ✅ OK |
| `providers.tsx` 수정 | mount 위치 | ✅ OK |

### False Negative (누락)
| 구현 내용 | Scope 포함 | 판정 |
|----------|-----------|------|
| Host store 구독 | ✅ lp-proposal-modal.tsx | OK |
| Card 렌더 | ✅ lp-proposal-modal.tsx | OK |
| 백드롭 + 닫기 | ✅ lp-proposal-modal.tsx | OK |
| providers mount | ✅ providers.tsx | OK |

### 검증 통과: ✅

---

→ 다음: [Step 05: chat.tsx 연계 (clear + selection)](step-05-chat-wiring.md)

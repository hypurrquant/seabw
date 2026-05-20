# Step 02: useLpProposalStore (zustand)

## 메타데이터
- **난이도**: 🟡 보통
- **롤백 가능**: ✅ (단일 파일 삭제)
- **선행 조건**: Step 01 (LpProposal 타입 사용)

---

## 1. 구현 내용 (design.md 기반)

- `apps/web/src/domains/agent/stores/use-lp-proposal-store.ts` 신규 작성
- `LpProposalState`: `proposals: Record<string, ProposalEntry>` (sessionId 키)
- `LpProposalActions`:
  - `addProposal(sessionId: string, proposal: LpProposal)` — 기존 무조건 교체
  - `clearProposal(sessionId: string)` — 해당 sessionId proposal 제거
  - `selectProposal(sessionId: string, rank: 1|2|3) → LpCard | null`
- zustand `create<State & Actions>` 패턴 (HQ `createPipelineStore` 시그니처 따름)
- unit test 파일 함께 (`use-lp-proposal-store.test.ts`)

## 2. 완료 조건 ⚠️

- [ ] `use-lp-proposal-store.ts` 파일 존재
- [ ] `useLpProposalStore` named export (`grep "export const useLpProposalStore" ...` 1 hit)
- [ ] `addProposal` / `clearProposal` / `selectProposal` 3개 액션 정의 (각 grep 1+ hit)
- [ ] `addProposal` 같은 sessionId 호출 시 기존 proposal 교체 동작 (unit test 통과)
- [ ] `selectProposal` rank ∈ {1,2,3} 시 LpCard 반환, 그 외 null (unit test 통과)
- [ ] `clearProposal` 후 `proposals[sessionId]` undefined (unit test 통과)
- [ ] `pnpm typecheck` 통과
- [ ] `pnpm test` 신규 test 3건 통과

## 3. 롤백 방법

- 파일 삭제: `rm apps/web/src/domains/agent/stores/use-lp-proposal-store.ts use-lp-proposal-store.test.ts`
- 영향 범위: Step 03/04 가 import 하므로 함께 롤백.

---

## Scope

### 수정 대상 파일
없음.

### 신규 생성 파일
```
apps/web/src/domains/agent/stores/
├── use-lp-proposal-store.ts         # 신규 - zustand store
└── use-lp-proposal-store.test.ts    # 신규 - vitest unit test
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| `zustand` | 사용 | v1.2.1 2차에서 추가됨 (HQ 패키지 경유). 신규 의존성 추가 X |
| Step 01 `LpProposal`/`LpCard` 타입 | import | type-only |

### Side Effect 위험
- 없음. zustand singleton 이지만 sessionId-scoped 라 다른 세션 영향 없음.

### 참고할 기존 패턴
- HQ `packages/react/agent/store/createPipelineStore.ts` — `create<State & Actions>(...)` 패턴.

---

## FP/FN 검증

### False Positive (과잉)
| Scope 항목 | 구현 내용 근거 | 판정 |
|-----------|---------------|------|
| `use-lp-proposal-store.ts` | State + 3 actions | ✅ OK |
| `use-lp-proposal-store.test.ts` | DoD N4 (5건 unit test 통과) 의 3건 커버 | ✅ OK |

### False Negative (누락)
| 구현 내용 | Scope 포함 | 판정 |
|----------|-----------|------|
| addProposal action | ✅ | OK |
| clearProposal action | ✅ | OK |
| selectProposal action | ✅ | OK |
| unit test 3건 | ✅ | OK |

### 검증 통과: ✅

---

→ 다음: [Step 03: handler + registry 등록](step-03-handler.md)

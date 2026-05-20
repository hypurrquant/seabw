# Step 03: propose_lp_positions handler + registry 등록

## 메타데이터
- **난이도**: 🟠 중간
- **롤백 가능**: ✅ (handler 파일 삭제 + registry 등록 1줄 revert)
- **선행 조건**: Step 01 (schema) + Step 02 (store)

---

## 1. 구현 내용 (design.md 기반)

- `apps/web/src/domains/agent/tools/propose-lp-positions/handler.ts` 신규
  - `createProposeLpPositionsHandler({ lpProposalStore })` factory
  - args 를 `LpProposalArgsSchema.safeParse` → 실패 시 `{status:'error', code:'INVALID_ARGS'}`
  - 카드 3개에 `crypto.randomUUID()` ID 부여 (`withCardIds(proposal)` 헬퍼)
  - `lpProposalStore.getState().addProposal(context.sessionId, proposalWithIds)`
  - 반환 `{status:'success', data:{cardIds: [...]}}`
- `apps/web/src/domains/agent/tools/propose-lp-positions/index.ts` 신규 — barrel export
- handler.test.ts — 4건:
  - happy path → store.addProposal 호출 + success 반환
  - 카드 2개 args → INVALID_ARGS
  - 카드 4개 args → INVALID_ARGS
  - 카드 id 자동 부여 검증
- `apps/web/src/domains/agent/tools/index.ts` 수정 — registry 등록 1줄
  - `registry.register('propose_lp_positions', createProposeLpPositionsHandler({ lpProposalStore: useLpProposalStore }))`
- `console.info('[lp-proposal]', ...)` 로그 (관측성, DoD N7)

## 2. 완료 조건 ⚠️

- [ ] `handler.ts` 가 `export function createProposeLpPositionsHandler` 정의 (`grep ...` 1 hit)
- [ ] handler 가 args 검증 실패 시 `code:'INVALID_ARGS'` 반환 (unit test)
- [ ] handler 가 성공 시 `lpProposalStore.addProposal` 호출 + `{status:'success', data:{cardIds:[3개]}}` 반환 (unit test)
- [ ] 카드별 `id` 가 uuid v4 형식 (`grep "randomUUID" handler.ts` 1+ hit + unit test)
- [ ] `apps/web/src/domains/agent/tools/index.ts` 에 `propose_lp_positions` 등록 (`grep "propose_lp_positions" .../index.ts` 1+ hit)
- [ ] handler unit test 4건 통과
- [ ] `console.info('[lp-proposal]'` 로그 2+ 위치 (handler 진입 / 검증 실패 / store push)
- [ ] `pnpm typecheck` + `pnpm test` 통과

## 3. 롤백 방법

- `rm -rf apps/web/src/domains/agent/tools/propose-lp-positions/`
- `apps/web/src/domains/agent/tools/index.ts` 의 등록 1줄 revert
- 영향 범위: registry 에서 tool 미등록 — LLM 이 호출 시 "TOOL_NOT_FOUND" 반환 (graceful)

---

## Scope

### 수정 대상 파일
```
apps/web/src/domains/agent/tools/
└── index.ts    # 수정 - registry.register('propose_lp_positions', ...) 1줄 추가
```

### 신규 생성 파일
```
apps/web/src/domains/agent/tools/propose-lp-positions/
├── handler.ts          # 신규 - createProposeLpPositionsHandler factory
├── handler.test.ts     # 신규 - vitest 4건
└── index.ts            # 신규 - barrel export
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| Step 01 schema | import | `LpProposalArgsSchema`, `LpCard` 타입 |
| Step 02 store | import | `useLpProposalStore` |
| HQ `BrowserToolHandler` 타입 | import | v1.2.1 2차 산출물 |
| `crypto.randomUUID` | 사용 | Node 19+ / 모던 브라우저 기본 (Next.js 15 OK) |

### Side Effect 위험
- **risk 1**: registry 등록 위치가 잘못되어 다른 tool 의 등록 순서 영향 — 없음 (Map 기반). 단, registry 인스턴스가 1개라는 가정 — 다중 인스턴스 시 다른 tool 미등록 위험 (v1.2.1 2차 결과에 따라 점검).

### 참고할 기존 패턴
- HQ `apps/web/src/domains/agent/tools/get-token-balances.ts` — handler factory 패턴 (Explore 결과 1번).
- HQ `apps/web/src/domains/agent/tools/index.ts` — registry 등록 패턴.

---

## FP/FN 검증

### False Positive (과잉)
| Scope 항목 | 구현 내용 근거 | 판정 |
|-----------|---------------|------|
| `propose-lp-positions/handler.ts` | createProposeLpPositionsHandler | ✅ OK |
| `propose-lp-positions/handler.test.ts` | DoD N4 unit test | ✅ OK |
| `propose-lp-positions/index.ts` | barrel export (가독성) | ✅ OK |
| `apps/web/src/domains/agent/tools/index.ts` | registry 등록 | ✅ OK |

### False Negative (누락)
| 구현 내용 | Scope 포함 | 판정 |
|----------|-----------|------|
| handler factory | ✅ handler.ts | OK |
| registry 등록 | ✅ tools/index.ts 수정 | OK |
| unit test 4건 | ✅ handler.test.ts | OK |
| 관측성 로그 | ✅ handler.ts 내부 | OK |

### 검증 통과: ✅

---

→ 다음: [Step 04: LpProposalModal UI](step-04-modal.md)

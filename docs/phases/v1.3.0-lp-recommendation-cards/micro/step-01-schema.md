# Step 01: LpCard / LpProposal zod 스키마 + 타입

## 메타데이터
- **난이도**: 🟡 보통
- **롤백 가능**: ✅ (단일 파일 삭제)
- **선행 조건**: v1.2.1 2차 완료 (`apps/web/src/domains/agent/tools/` 디렉토리 존재)

---

## 1. 구현 내용 (design.md 기반)

- `apps/web/src/domains/agent/tools/propose-lp-positions/schema.ts` 신규 작성
  - `TokenRefSchema` (symbol/address/decimals/logoUri)
  - `LpCardArgsSchema` — rank(1|2|3), protocol, chainId, pair, feeTier?, poolAddress, metrics, position, reasoning, recipe(`z.array(z.unknown())`), estimatedGasUsd?
  - `LpProposalArgsSchema` — `proposal: { cards: z.tuple([..., ..., ...]), rationale: string }` (정확히 3개 강제)
  - 타입 export: `LpCard`, `LpProposal`, `TokenRef`

## 2. 완료 조건 ⚠️

- [ ] `schema.ts` 파일 존재 (`[ -f apps/web/src/domains/agent/tools/propose-lp-positions/schema.ts ]`)
- [ ] `z.tuple` 으로 cards 3개 튜플 정의 (`grep "z.tuple" .../schema.ts` 1+ hit)
- [ ] rank 가 `z.union([z.literal(1), z.literal(2), z.literal(3)])` (`grep "z.literal(1)" .../schema.ts` 1 hit)
- [ ] `LpCard`, `LpProposal`, `TokenRef` 타입 export (`grep "^export type" .../schema.ts` 3 hits)
- [ ] `tierAlignment` 가 `z.enum(['match', 'stretch', 'warning'])` (`grep "tierAlignment" .../schema.ts` 1+ hit)
- [ ] `ilRisk` 가 `z.enum(['low', 'medium', 'high'])` (`grep "ilRisk" .../schema.ts` 1+ hit)
- [ ] `pnpm typecheck` 통과

## 3. 롤백 방법

- 파일 1개 삭제: `rm -rf apps/web/src/domains/agent/tools/propose-lp-positions/`
- 영향 범위: 본 step 단독. 다른 코드에서 import 없음 (Step 03 부터 의존).

---

## Scope

### 수정 대상 파일
없음.

### 신규 생성 파일
```
apps/web/src/domains/agent/tools/propose-lp-positions/
└── schema.ts          # 신규 - zod 스키마 + 타입 export
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| `zod` | 사용 | 이미 의존성 존재 (v1.0.0 부터) |

### Side Effect 위험
- 없음. 신규 파일 1개만.

### 참고할 기존 패턴
- `apps/web/src/domains/survey/lib.ts` — zod 스키마 + 타입 export 패턴 (Answers/TierResult).

---

## FP/FN 검증

### False Positive (과잉)
| Scope 항목 | 구현 내용 근거 | 판정 |
|-----------|---------------|------|
| `propose-lp-positions/schema.ts` | LpCardArgsSchema, LpProposalArgsSchema, TokenRefSchema, 타입 export | ✅ OK |

### False Negative (누락)
| 구현 내용 | Scope 포함 | 판정 |
|----------|-----------|------|
| TokenRefSchema | ✅ schema.ts 내부 | OK |
| LpCardArgsSchema | ✅ schema.ts 내부 | OK |
| LpProposalArgsSchema | ✅ schema.ts 내부 | OK |
| LpCard/LpProposal/TokenRef 타입 export | ✅ schema.ts 내부 | OK |

### 검증 통과: ✅

---

→ 다음: [Step 02: useLpProposalStore](step-02-store.md)

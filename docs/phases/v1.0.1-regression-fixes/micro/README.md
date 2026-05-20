# 작업 티켓 - v1.0.1

## 전체 현황

| # | Step | 난이도 | 상태 | 완료일 |
|---|------|--------|------|--------|
| 01 | Zod validation envelope 원형 복원 | 🟡 | ⏳ | - |
| 02 | Plan 실패 audit + retry-after | 🟠 | ⏳ | - |
| 03 | Intent abort/timeout 정합 | 🟠 | ⏳ | - |
| 04 | Marketplace plan 실패 응답 | 🟢 | ⏳ | - |
| 05 | Portfolio 502 + rehydrate schema parse | 🟢 | ⏳ | - |

## 의존성
독립 (병렬 가능). 순서: 01 → 02 → 03 → 04 → 05 (난이도/관련 영역 그룹화).

## Step 상세
- [Step 01: validation envelope](step-01-validation-envelope.md)
- [Step 02: plan failure audit + retry-after](step-02-plan-failure-audit.md)
- [Step 03: intent abort wiring](step-03-intent-abort-wiring.md)
- [Step 04: marketplace plan catch](step-04-marketplace-plan-catch.md)
- [Step 05: portfolio 502 + rehydrate parse](step-05-portfolio-502.md)

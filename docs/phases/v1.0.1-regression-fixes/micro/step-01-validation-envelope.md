# Step 01: Zod validation envelope 원형 복원

## 메타데이터
- **난이도**: 🟡
- **선행 조건**: 없음

## 구현 내용
- `ZodValidationPipe` 생성자에 옵션 `{ errorMessage?: string }` 추가. 던지는 envelope을
  `{ error: errorMessage ?? "Validation failed", issues }` 로 변경 (원본 route 들과 동일).
- 6개 controller 에서 `new ZodValidationPipe(schema, { errorMessage: "..." })` 로 메시지 명시:
  - PlanController.create: `"Invalid plan request"`
  - PlanController.rehydrate: `"Invalid rehydrate payload"`
  - PrecheckController.run: `"Invalid precheck payload"`
  - MarketplaceController.composePlan: `"Invalid basket request"`
  - MarketplaceController.listYields: `"Missing or invalid tier"` (수동 검증 경로 메시지)
  - PortfolioController.health: `"Invalid address or chainId"` (수동 검증 경로 메시지)

## 완료 조건
- [ ] ZodValidationPipe 가 옵션 메시지를 수용
- [ ] 6개 controller 의 잘못된 body 응답이 원본 message 와 일치
- [ ] `grep -c "Invalid plan request\|Invalid precheck payload" apps/server/src` ≥ 2

## Scope
### 수정 대상
- `apps/server/src/common/zod-validation.pipe.ts` — 옵션 인자 추가
- `apps/server/src/domains/plan/plan.controller.ts` — 두 UsePipes 메시지 명시
- `apps/server/src/domains/precheck/precheck.controller.ts`
- `apps/server/src/domains/marketplace/marketplace.controller.ts`
- `apps/server/src/domains/portfolio/portfolio.controller.ts` — 수동 메시지 통일

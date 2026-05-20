# Step 05: Portfolio health 502 복원 + rehydrate schema parse

## 메타데이터
- **난이도**: 🟢
- **선행 조건**: 없음

## 구현 내용
- `PortfolioController.health`: catch 블록의 `InternalServerErrorException` 을
  `HttpException({ error: ... }, 502)` 로 교체.
- `PlanService.rehydrate`: 반환 직전 `PipelinePlanSchema.parse(refreshed)` 적용 후
  `rememberPlan` 및 body 에 검증된 객체 사용.

## 완료 조건
- [ ] /api/portfolio/health 의 defi-cli 실패가 502 반환
- [ ] /api/plan/rehydrate 가 PipelinePlanSchema.parse 통과한 plan 만 저장/반환

## Scope
### 수정 대상
- `apps/server/src/domains/portfolio/portfolio.controller.ts`
- `apps/server/src/domains/plan/plan.service.ts`

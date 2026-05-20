# Step 05: 4개 도메인 모듈 + 컨트롤러 (6개 API 이전)

## 메타데이터
- **난이도**: 🟠 중간
- **롤백 가능**: ✅
- **선행 조건**: Step 04

---

## 1. 구현 내용

도메인별 NestJS Module + Controller + Service. URL path, request/response shape은 기존 src/app/api 와 동일하게 유지.

### 도메인 → 엔드포인트 매핑

#### plan
- `POST /api/plan` — PlanController.create
- `POST /api/plan/rehydrate` — PlanController.rehydrate
- service: `PlanService` (composePlan, tryHydrateCalldata, evaluatePlan, rememberPlan, rateLimit, logPlanRequest 오케스트레이션)
- IntentService 의존은 Step 07에서 주입. **임시로 Step 05에서는 `parseIntentHeuristic` 만 사용** (Anthropic 의존 제거를 위한 최소 동작).

#### marketplace
- `GET /api/marketplace/yields` — MarketplaceController.listYields
- `POST /api/marketplace/plan` — MarketplaceController.composePlan
- service: `MarketplaceService` (composeBasketPlan, liveCatalogForTier)

#### precheck
- `POST /api/precheck` — PrecheckController.run
- service: `PrecheckService` (recallPlan + isSanctioned + canonical calldata 검증)

#### portfolio
- `GET /api/portfolio/health` — PortfolioController.health
- service: `PortfolioService` (lpPositions + portfolioShow + classifyPortfolio)

### 공통
- 각 controller method의 body 타입은 core DTO (`PlanRequest`, `MarketplacePlanRequest` 등). 응답 타입은 core 응답 DTO. raw 반환 (envelope 미적용). 단 예외는 ExceptionFilter가 envelope으로 감쌈.
- ZodValidationPipe로 body 검증 (core schemas 재사용).
- AppModule이 4개 도메인 모듈을 imports.

### 헬퍼
- `apps/server/src/common/req-context.ts`: client IP / wallet 추출 helper (auditLog 호출 시 사용)

## 2. 완료 조건
- [ ] `POST /api/plan` 200 응답 + body 검증 + 기존 shape `{ plan: PipelinePlan }` 동일
- [ ] `POST /api/plan/rehydrate` 동일
- [ ] `GET /api/marketplace/yields?tier=safe` 200 + `{ tier, count, products }`
- [ ] `POST /api/marketplace/plan` 200 + `{ plan }`
- [ ] `POST /api/precheck` 200 + ok/reason
- [ ] `GET /api/portfolio/health?address=0x..&chainId=1` 200 + `{ health }`
- [ ] 잘못된 body → 400 + envelope
- [ ] `pnpm --filter @seabw/server build` exit 0
- [ ] 4개 모듈 파일 존재 (`*.module.ts`, `*.controller.ts`, `*.service.ts`)
- [ ] AppModule.imports에 4개 모듈 포함

## 3. 롤백 방법
- `apps/server/src/domains/{plan,marketplace,precheck,portfolio}/{*.module,*.controller,*.service}.ts` 삭제
- AppModule.imports에서 제거

---

## Scope

### 신규 생성 파일
```
apps/server/src/domains/plan/plan.module.ts
apps/server/src/domains/plan/plan.controller.ts
apps/server/src/domains/plan/plan.service.ts
apps/server/src/domains/marketplace/marketplace.module.ts
apps/server/src/domains/marketplace/marketplace.controller.ts
apps/server/src/domains/marketplace/marketplace.service.ts
apps/server/src/domains/precheck/precheck.module.ts
apps/server/src/domains/precheck/precheck.controller.ts
apps/server/src/domains/precheck/precheck.service.ts
apps/server/src/domains/portfolio/portfolio.module.ts
apps/server/src/domains/portfolio/portfolio.controller.ts
apps/server/src/domains/portfolio/portfolio.service.ts
apps/server/src/common/req-context.ts
```

### 수정 대상 파일
```
apps/server/src/app.module.ts   # 4개 모듈 imports에 추가
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| domains/*/internal/* (Step 04) | import | service에서 사용 |
| @seabw/core | import | DTO + schemas |

### Side Effect 위험
- ratelimit/auditLog 호출 시 req IP 추출 — req-context.ts가 일관되게 처리.
- 기존 클라이언트가 `Content-Type: application/json` 가정 → controller 기본 JSON. SSE는 agent에만 적용.

### 참고할 기존 패턴
- 기존 `src/app/api/plan/route.ts` 의 body parsing → ZodValidationPipe로 대체.
- 참조 `apps/server/src/domains/pool/infrastructure/pool.controller.ts`.

## FP/FN 검증

### FP
- `domains/*/interface/` 디렉토리 — 참조는 interface/infrastructure 분리하지만 우리는 controller를 도메인 루트에 두므로 (스코프 작음) interface/ 생략. ✅.

### FN
- agent 모듈 → Step 06.
- intent.ts → Step 07.
- 6개 API의 controller method 모두 정의됨 ✅.

### 검증 통과: ✅

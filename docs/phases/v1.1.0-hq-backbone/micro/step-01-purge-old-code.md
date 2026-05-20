# Step 01: 옛 도메인·컴포넌트 일괄 삭제

## 메타데이터
- **난이도**: 🟠 (단일 작업이나 파일 수 많음)
- **선행 조건**: 없음

## 구현 내용

seabw의 옛 DeFi 구조(`defi-cli` 기반 plan/marketplace/portfolio/precheck 흐름)와 관련 자산을 통째로 제거.

### 삭제 대상

**apps/server**
- `apps/server/src/lib/defi-cli.ts`
- `apps/server/src/lib/__tests__/` (있다면 통째)
- `apps/server/src/__tests__/mainnet-staticcall.test.ts`
- `apps/server/src/domains/plan/` (전체)
- `apps/server/src/domains/marketplace/` (전체)
- `apps/server/src/domains/portfolio/` (전체)
- `apps/server/src/domains/precheck/` (전체)
- `apps/server/src/domains/agent/` (전체 — HQ가 대체)

**apps/core**
- `apps/core/types/yield-product.ts`
- `apps/core/types/portfolio.ts`
- `apps/core/schemas/index.ts` 의 defi-cli 관련 zod schemas (`DefiCliQuoteSchema`, `YieldScanRowSchema`, `PriceRowSchema`, `StatusChainSchema` 등) — 파일 자체가 그것만 가지면 파일 삭제
- `apps/core/types/index.ts` 의 위 타입 re-export 제거
- `apps/core/http/dto.ts` 중 옛 DeFi DTO (없으면 skip)

**apps/web**
- `apps/web/src/app/portfolio/` (전체)
- `apps/web/src/app/risks/` (전체)
- `apps/web/src/components/basket-bar.tsx`
- `apps/web/src/components/basket-review.tsx`
- `apps/web/src/components/dag-node.tsx`
- `apps/web/src/components/intent-input.tsx`
- `apps/web/src/components/marketplace.tsx`
- `apps/web/src/components/plan-review.tsx`
- `apps/web/src/components/portfolio-summary.tsx`
- `apps/web/src/components/product-detail.tsx`
- `apps/web/src/components/sign-flow.tsx`
- `apps/web/src/components/stage-indicator.tsx`
- `apps/web/src/components/demo-banner.tsx`
- `apps/web/src/components/landing.tsx` 의 defi-cli 의존부 제거 (단순 페이지로 축소, 또는 삭제 후 Step 03에서 재작성)
- `apps/web/src/lib/guardrail-labels.ts`
- `apps/web/src/__tests__/` 중 위 컴포넌트·domain 의존 spec

**e2e (있다면)**
- `e2e/` 중 위 흐름 playwright 시나리오

**.env 정리**
- `apps/server/.env*`, `apps/web/.env*` 에서 `DEFI_CLI_*`, `DEFIPILOT_*` 라인 제거 (.env.example/.env.local 모두)

## 완료 조건
- [ ] DoD 1 충족: `[ ! -f apps/server/src/lib/defi-cli.ts ]`
- [ ] DoD 2 충족: `rg "defi-cli|defiCli|DefiCli" apps src` → 0 hits
- [ ] DoD 3 충족: `rg "DEFI_CLI_|DEFIPILOT_" apps src docs .env*` → 0 hits
- [ ] DoD 7 충족: portfolio/risks 페이지 디렉토리 없음
- [ ] DoD 8 충족: 옛 components 11개 모두 없음
- [ ] `git status` 로 삭제 파일 목록 확인 후 commit

## Scope

### 삭제
(위 "삭제 대상" 전체)

### 수정 (참조 끊기)
- `apps/server/src/app.module.ts` — 삭제된 모듈 import 제거 (Step 02에서 처리해도 됨)
- `apps/core/types/index.ts` — 삭제된 타입 re-export 제거
- `apps/core/http/dto.ts` — 옛 DTO import 제거
- `apps/web/src/state/app-state.tsx` — 삭제된 stage/타입 참조 제거 (Step 03에서 처리해도 됨)
- `apps/web/src/components/site-header.tsx`, `connect-wallet.tsx` — 삭제된 컴포넌트 import 있으면 제거
- `apps/web/src/app/page.tsx`, `apps/web/src/app/layout.tsx` — 삭제된 컴포넌트 import 제거

### 신규
없음

## Side Effect 위험
- 삭제 직후 typecheck/build는 깨질 수 있음 (Step 02/03 완료까지). 본 step은 **"의도적으로 빌드 깨진 상태"** 로 끝낼 수 있음.
- HQ worktree, src/(휴면) 디렉토리는 건드리지 않음.

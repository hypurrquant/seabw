# Step 04: 서버 내부 로직 이전 (composer / policy / lib)

## 메타데이터
- **난이도**: 🟠 중간
- **롤백 가능**: ✅
- **선행 조건**: Step 03

---

## 1. 구현 내용

기존 src/ 의 서버 전용 로직을 apps/server 내부로 복사 (src/는 보존). import 경로를 `@seabw/core` 또는 server 내부 상대 경로로 갱신.

이전 매핑:

| 원본 | 신규 위치 | 비고 |
|------|----------|------|
| `src/agent/composer.ts` | `apps/server/src/domains/plan/internal/composer.ts` | `@/types` → `@seabw/core/types`, `@/schemas` → `@seabw/core/schemas`, `@/lib/fixtures` → `./fixtures`, `@/policy/whitelist` → `./whitelist`, `@/lib/defiCli` → `../../../lib/defi-cli`, `@/agent/tools` → `./tools`, `@/config/chains` → `@seabw/core/config`, `@/lib/prices` → `./prices` |
| `src/agent/basket-composer.ts` | `apps/server/src/domains/marketplace/internal/basket-composer.ts` | 동일 패턴 |
| `src/agent/tools.ts` | `apps/server/src/domains/plan/internal/tools.ts` | (assertToolAllowed 정책) |
| `src/policy/guardrails.ts` | `apps/server/src/domains/plan/internal/guardrails.ts` | |
| `src/policy/whitelist.ts` | `apps/server/src/domains/plan/internal/whitelist.ts` | |
| `src/policy/sanctions.ts` | `apps/server/src/domains/precheck/internal/sanctions.ts` | |
| `src/lib/prices.ts` | `apps/server/src/domains/plan/internal/prices.ts` | server-side HTTP fetch |
| `src/lib/yields.ts` | `apps/server/src/domains/marketplace/internal/yields.ts` | |
| `src/lib/planStore.ts` | `apps/server/src/domains/plan/internal/plan-store.ts` | 메모리 저장소 |
| `src/lib/auditLog.ts` | `apps/server/src/domains/plan/internal/audit-log.ts` | |
| `src/lib/risk.ts` | `apps/server/src/domains/portfolio/internal/risk.ts` | |
| `src/lib/fixtures.ts` | `apps/server/src/domains/plan/internal/fixtures.ts` | composer 내부 fixture |
| `src/lib/defiCli.ts` | `apps/server/src/lib/defi-cli.ts` | server 공용 lib (여러 domain 공유) |
| `src/lib/ratelimit.ts` | `apps/server/src/lib/ratelimit.ts` | server 공용 |

추가 작업:
- `composer.ts`의 `priceMap`은 `prices.ts`에서 import. tools.ts는 plan 내부에 둠 (basket-composer도 import 필요 시 cross-domain import 허용).
- intent.ts는 **이번 step에서 이전하지 않음** — Step 07에서 IntentService로 재작성.

기존 server 의존성:
- defi-cli external binary (`@hypurrquant/defi-cli` 가 dependencies 에 있으면 server로 옮김)
- 외부 fetch (prices/yields) — Node 20 글로벌 fetch 사용

## 2. 완료 조건
- [ ] 위 표의 모든 파일이 `apps/server/src/...` 경로에 존재
- [ ] 이전된 파일들의 import가 `@seabw/core` 또는 상대경로로 갱신 (`@/...` 잔존 0)
- [ ] `pnpm --filter @seabw/server exec tsc --noEmit` exit 0
- [ ] src/ 의 원본 파일들은 그대로 (수정 0건) — git diff 확인
- [ ] `grep -rn "@anthropic-ai/sdk" apps/server/src` → 0 (intent.ts 미이전)

## 3. 롤백 방법
- 신규 이전 파일들 삭제 (`apps/server/src/domains/{plan,marketplace,precheck,portfolio}/internal/`, `apps/server/src/lib/*.ts`)

---

## Scope

### 신규 생성 파일 (15개+)
```
apps/server/src/domains/plan/internal/composer.ts
apps/server/src/domains/plan/internal/basket-composer.ts            # ← marketplace로? -- 아래 결정
apps/server/src/domains/plan/internal/tools.ts
apps/server/src/domains/plan/internal/guardrails.ts
apps/server/src/domains/plan/internal/whitelist.ts
apps/server/src/domains/plan/internal/prices.ts
apps/server/src/domains/plan/internal/plan-store.ts
apps/server/src/domains/plan/internal/audit-log.ts
apps/server/src/domains/plan/internal/fixtures.ts
apps/server/src/domains/marketplace/internal/basket-composer.ts
apps/server/src/domains/marketplace/internal/yields.ts
apps/server/src/domains/precheck/internal/sanctions.ts
apps/server/src/domains/portfolio/internal/risk.ts
apps/server/src/lib/defi-cli.ts
apps/server/src/lib/ratelimit.ts
```

### 수정 대상 파일
- 없음 (신규 파일만 추가; controller는 Step 05에서 작성)

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| `@hypurrquant/defi-cli` 또는 정의된 의존 | server로 이동 | dependencies 분배 (루트 package.json → apps/server/package.json) |
| @seabw/core types/schemas/config | 신규 import 경로 | composer.ts 등에서 |
| cross-domain (basket-composer가 plan 내부 prices import) | 허용 | basket-composer는 marketplace 내부지만 plan/internal/prices를 import 가능 (Nest에서 강제 안 함) |

### Side Effect 위험
- composer.ts의 `priceMap(allSymbols, chainId, opts.signal)` — prices.ts 가 외부 fetch — Node 20 환경 확인.
- defi-cli 바이너리 호출 — spawn 경로(`defi-cli`)는 PATH 의존, 기존과 동일.

### 참고할 기존 패턴
- 참조 프로젝트의 `apps/server/src/lib/lp-runtime`, `apps/server/src/lib/catalog` — server 공용 lib 패턴.

## FP/FN 검증

### FP
- src/lib/wagmi.ts, src/lib/utils.ts — 클라이언트 UI 의존. server 이전 대상 아님 ✅ 제외.

### FN
- src/lib/__tests__/* — 테스트 이전은 Step 09에서 일괄. ✅ 명시됨.
- composer 내부에서 `@/agent/tools` import — 같은 도메인 내부로 처리, scope에 포함 ✅.

### 검증 통과: ✅

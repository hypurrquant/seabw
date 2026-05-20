# Step 09: 테스트 이전 + DoD 자동 검증

## 메타데이터
- **난이도**: 🟠 중간
- **롤백 가능**: ✅
- **선행 조건**: Step 04-08

---

## 1. 구현 내용

### 테스트 이전
- `src/__tests__/`, `src/agent/__tests__/`, `src/lib/__tests__/`, `src/policy/__tests__/`, `src/app/api/**/__tests__/` 의 모든 테스트를 해당 신규 위치로 복사 + import 경로 갱신.

| 원본 | 신규 위치 |
|------|----------|
| `src/agent/__tests__/composer.test.ts` | `apps/server/src/domains/plan/internal/__tests__/composer.test.ts` |
| `src/agent/__tests__/basket-composer.test.ts` | `apps/server/src/domains/marketplace/internal/__tests__/basket-composer.test.ts` |
| `src/agent/__tests__/intent.test.ts` | `apps/server/src/domains/agent/application/__tests__/intent.heuristic.test.ts` (휴리스틱만, LLM 부분은 새로 작성된 intent.service.test.ts가 대체) |
| `src/lib/__tests__/ratelimit.test.ts` | `apps/server/src/lib/__tests__/ratelimit.test.ts` |
| `src/lib/__tests__/tiers.test.ts` | `apps/core/lib/__tests__/tiers.test.ts` (core 패키지 vitest) |
| `src/lib/__tests__/planStore.test.ts` | `apps/server/src/domains/plan/internal/__tests__/plan-store.test.ts` |
| `src/lib/__tests__/prices.test.ts` | `apps/server/src/domains/plan/internal/__tests__/prices.test.ts` |
| `src/lib/__tests__/yields.test.ts` | `apps/server/src/domains/marketplace/internal/__tests__/yields.test.ts` |
| `src/policy/__tests__/guardrails.test.ts` | `apps/server/src/domains/plan/internal/__tests__/guardrails.test.ts` |
| `src/policy/__tests__/sanctions.test.ts` | `apps/server/src/domains/precheck/internal/__tests__/sanctions.test.ts` |
| `src/policy/__tests__/whitelist.test.ts` | `apps/server/src/domains/plan/internal/__tests__/whitelist.test.ts` |
| `src/app/api/plan/__tests__/route.test.ts` | `apps/server/src/domains/plan/__tests__/plan.controller.test.ts` (Nest TestingModule + supertest) |
| `src/app/api/plan/rehydrate/__tests__/route.test.ts` | 동일 controller test에 포함 |
| `src/app/api/marketplace/plan/__tests__/route.test.ts` | `apps/server/src/domains/marketplace/__tests__/marketplace.controller.test.ts` |
| `src/app/api/marketplace/yields/__tests__/route.test.ts` | 동일 controller test |
| `src/app/api/precheck/__tests__/route.test.ts` | `apps/server/src/domains/precheck/__tests__/precheck.controller.test.ts` |
| `src/__tests__/dom-environment.test.ts` | `apps/web/src/__tests__/dom-environment.test.ts` |
| `src/__tests__/mainnet-staticcall.test.ts` | `apps/server/src/__tests__/mainnet-staticcall.test.ts` (server) |

### 신규 테스트
- `apps/server/src/domains/agent/application/__tests__/intent.service.test.ts` — LLMPort mock으로 JSON 응답 + error + non-JSON 처리.
- `apps/server/src/domains/agent/infrastructure/__tests__/acpx-llm.adapter.test.ts` — child_process spawn mock, ENOENT 처리.
- `apps/server/src/domains/agent/interface/__tests__/agent.controller.sse.test.ts` — Nest TestingModule + supertest로 /agent/chat SSE 응답.

### 자동 검증 스크립트
- `scripts/verify-dod.sh` (신규): DoD에 정의된 grep 기반 검증을 자동화.
  - `grep -r "@anthropic-ai/sdk" apps/ → must be 0`
  - `grep -r "ANTHROPIC_API_KEY" apps/ → must be 0`
  - `find apps/server -name "mcp*" → must be 0 files`
  - `find apps/web/src/app/api -type f 2>/dev/null → must be 0 files`
  - `find src -type f | wc -l → must equal baseline (저장된 baseline 값과 비교)`
- 루트 `package.json` scripts에 `verify:dod` 추가.

## 2. 완료 조건
- [ ] `pnpm --filter @seabw/server test` exit 0, fail 0
- [ ] `pnpm --filter @seabw/core test` exit 0
- [ ] `pnpm --filter @seabw/web test` exit 0 (또는 web 테스트 부재 시 skip 명시)
- [ ] `pnpm -r test` 루트에서 exit 0
- [ ] `pnpm verify:dod` exit 0
- [ ] 이전된 모든 테스트의 import 경로가 `@seabw/core` 또는 상대 경로 (`@/...` 잔존 0)
- [ ] supertest로 6개 controller 의 status code + raw payload shape 검증

## 3. 롤백 방법
- 새 위치의 테스트 디렉토리 삭제
- scripts/verify-dod.sh 삭제

---

## Scope

### 신규 생성 파일
```
apps/server/src/**/__tests__/*.test.ts   # 위 매핑 표 항목 전부
apps/web/src/__tests__/*.test.ts         # dom-environment
apps/core/lib/__tests__/tiers.test.ts
apps/server/src/domains/agent/application/__tests__/intent.service.test.ts
apps/server/src/domains/agent/infrastructure/__tests__/acpx-llm.adapter.test.ts
apps/server/src/domains/agent/interface/__tests__/agent.controller.sse.test.ts
scripts/verify-dod.sh
```

### 수정 대상 파일
```
package.json                              # verify:dod script 추가
apps/server/vitest.config.ts              # 테스트 매처 경로 추가
apps/core/vitest.config.ts                # 신설
apps/web/vitest.config.ts                 # 이전
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| vitest | 워크스페이스별 의존 | 각 apps/*에 devDep |
| supertest | server devDep | controller test |
| @nestjs/testing | server devDep | TestingModule |

### Side Effect 위험
- 기존 vitest 설정 (루트 `vitest.config.ts`, `vitest.mainnet.config.ts`)이 src/ 를 가리키는데, 모노레포에서 루트 test 명령은 워크스페이스 위임으로 변경 → src/ 테스트는 더 이상 실행 안 됨. 영향: 없음 (src/는 휴면).
- mainnet-staticcall.test.ts 는 외부 RPC 의존. mainnet vitest config는 server로 이전 + 환경변수 가드.

### 참고할 기존 패턴
- 참조 `apps/server/jest.config.ts` / `vitest` mix.

## FP/FN 검증

### FP
- src/__tests__ 의 mainnet-staticcall → web에 둘 필요 없음. server로 ✅.

### FN
- intent.service.test.ts 신규 — Step 07 완료조건과 중복으로 보일 수 있으나 여기서 일괄 실행 보장.
- acpx adapter test, agent controller sse test 신규 — F22, F19 검증 위해 필요 ✅.

### 검증 통과: ✅

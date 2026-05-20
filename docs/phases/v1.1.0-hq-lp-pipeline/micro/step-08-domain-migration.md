# Step 08: 기존 도메인 PoolDTO 마이그레이션

## 메타데이터
- **난이도**: 🟠 중간 (4개 도메인 동시 수정)
- **롤백 가능**: ✅
- **선행 조건**: Step 04 (PoolDTO/PositionDTO 필요)

---

## 1. 구현 내용

기존 4개 도메인의 LP/풀 관련 응답 타입을 **`@seabw/defi`의 PoolDTO/PositionDTO로 통일**.

### 대상 도메인 (각각의 응답 schema 갱신)

| 도메인 | 위치 | 변경 사항 |
|---|---|---|
| `marketplace` | `apps/server/src/domains/marketplace/` | yields/pools 응답 → `PoolDTO[]` |
| `plan` | `apps/server/src/domains/plan/` | suggest 응답에 `recipePreview: RecipeAtom[]` 추가, pool 참조는 PoolDTO |
| `precheck` | `apps/server/src/domains/precheck/` | LP 사전 검증 입력에 `poolId: PoolIdentity` 추가, response 단순화 |
| `portfolio` | `apps/server/src/domains/portfolio/` | positions/pnl 응답 → `PositionDTO[]` |

### 작업
- `apps/core/types/`, `apps/core/schemas/`, `apps/core/http/dto.ts` 에서 위 4개 도메인의 req/res DTO 타입을 `@seabw/defi`의 타입으로 import 변경 (또는 re-export로 통일)
- 각 controller의 메서드 시그너처와 service 내부 로직을 갱신
- 외부 URL/HTTP 메서드는 PRD 제약대로 유지
- 응답에 신규 필드 추가는 허용 (필드 추가가 클라 깨뜨리지 않음)

### 주의 — defi-cli 호출 자리
- 현재 service들이 `defi-cli.ts`를 호출하고 있을 수 있음. 본 step에서는 **호출만 주석 처리/임시 분기**하고 PoolDTO 구조로 응답하도록 변환 (실 데이터 fetch는 `@seabw/defi/lp/api.ts` 사용)
- defi-cli 호출 코드의 **완전 삭제는 Step 09**에서

### 테스트
- 각 도메인의 기존 controller spec 업데이트 (응답 shape 검증)
- e2e: `apps/web` 빌드 + 페이지 로드 시 응답이 정상 (Step 10에서 wiring 후 최종 검증)

## 2. 완료 조건
- [ ] `apps/server/src/domains/{marketplace,plan,precheck,portfolio}/` 각 controller의 응답 타입이 `@seabw/defi`에서 import됨
  - 검증: `rg "from '@seabw/defi'" apps/server/src/domains/{marketplace,plan,precheck,portfolio}` → 각 도메인에서 hit
- [ ] DoD F2.6 충족
- [ ] `pnpm -F @seabw/server build` 성공
- [ ] `pnpm -F @seabw/server test` 통과 (기존 spec 갱신본)
- [ ] 외부 API URL/메서드 변경 없음 (`git diff` 검토)

## 3. 롤백 방법
- `git checkout HEAD -- apps/server/src/domains/{marketplace,plan,precheck,portfolio}/ apps/core/`
- defi-cli 호출 흔적은 본 step에서 일부 주석 처리만 했을 뿐이므로 단독 롤백 안전

---

## Scope

### 수정 대상 파일 (도메인별)
```
apps/server/src/domains/marketplace/
  ├─ marketplace.controller.ts          # 응답 타입
  ├─ marketplace.service.ts             # PoolDTO로 변환, defi-cli 호출 주석
  └─ internal/yields.ts                  # PoolDTO 사용

apps/server/src/domains/plan/
  ├─ plan.controller.ts                  # 응답 타입
  ├─ plan.service.ts                     # RecipeAtom 추가
  └─ internal/composer.ts                # 결정론 로직은 유지, output에 RecipeAtom 추가

apps/server/src/domains/precheck/
  ├─ precheck.controller.ts              # 입력 DTO 갱신
  └─ precheck.service.ts                 # poolId 처리

apps/server/src/domains/portfolio/
  ├─ portfolio.controller.ts             # 응답 타입
  └─ portfolio.service.ts                # PositionDTO

apps/core/
  ├─ http/dto.ts                         # 6개 API DTO 타입
  ├─ schemas/index.ts                    # zod 스키마 갱신
  └─ types/index.ts                      # re-export
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| @seabw/defi | server workspace dep (이미 Step 06에서 추가) | 타입 import |
| apps/web | 간접 영향 | 응답 shape 변경에 따라 hook 재배선 필요 (Step 10에서) |

### Side Effect 위험
- 위험 1: web 클라이언트가 이전 응답 shape를 가정하므로 컴파일 또는 런타임 깨짐. 대응: Step 10에서 hook을 재배선하여 새 shape 소비. v1.1.0은 단일 cutover이므로 중간 시점에 web이 깨져도 phase 끝나면 회복.
- 위험 2: composer.ts의 결정론 로직이 PoolDTO를 가정하지 않으면 변환 어댑터가 필요. 대응: composer 입력은 그대로 두고 output 단계에서만 `toRecipeAtom()` 변환.
- 위험 3: defi-cli 호출 주석 처리 시 일부 endpoint가 mock 응답 반환 → integration 테스트 일시 fail. 대응: Step 09 직전까지 일시적 mock 허용.

### 참고할 기존 패턴
- 각 도메인 controller의 기존 응답 타입 (`apps/core/http/dto.ts`)
- `@seabw/defi/lp/types.ts` 의 PoolDTO export

---

## FP/FN 검증

### False Positive
| Scope 항목 | 근거 | 판정 |
|---|---|---|
| 4 domain controller/service | 4 도메인 마이그레이션 | ✅ |
| apps/core dto/schemas/types | DTO SSOT 갱신 | ✅ |

### False Negative
| 구현 내용 | Scope 포함 | 판정 |
|---|---|---|
| defi-cli 호출 주석 처리 | service 파일 수정에 포함 | OK |
| 외부 URL/메서드 보존 검증 | git diff 수동 검토 | OK |
| 응답 신규 필드 추가 (RecipeAtom) | plan.service.ts | OK |
| spec 파일 갱신 | (별도 명시 안 함 — 각 service 옆 spec 동시 수정) | ⚠️ 추가 명시: 4개 도메인 spec 파일 |

### Scope 보강
```
apps/server/src/domains/marketplace/marketplace.service.spec.ts
apps/server/src/domains/plan/plan.service.spec.ts
apps/server/src/domains/precheck/precheck.service.spec.ts
apps/server/src/domains/portfolio/portfolio.service.spec.ts
```

### 검증 통과: ✅ (Scope 보강 반영)

---

→ 다음: [Step 09: defi-cli 폐기](step-09-defi-cli-purge.md)

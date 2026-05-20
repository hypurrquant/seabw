# Step 02: apps/core 패키지 채우기 (타입 SSOT)

## 메타데이터
- **난이도**: 🟢 쉬움
- **롤백 가능**: ✅
- **선행 조건**: Step 01

---

## 1. 구현 내용

`apps/core`를 라이브러리 패키지로 채운다. 산출물 빌드 없이 소스 직접 export (참조 `@hq/core`와 동일 패턴).

- `apps/core/package.json`:
  - `name`: `@seabw/core`
  - `main`/`types`: `./index.ts`
  - `exports`: `"./*": "./*"` + `".": "./index.ts"`
  - `dependencies`: `zod` (참조에서 core에 viem 있지만 우리는 viem 미사용)
- `apps/core/index.ts`: 하위 디렉토리 전부 re-export.
- 디렉토리 구성:
  - `types/` ← `src/types/` 복사
  - `schemas/` ← `src/schemas/` 복사
  - `config/` ← `src/config/` 복사 (chains.ts 등)
  - `http/`
    - `api-response.ts`: `type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }`
    - `dto.ts`: 6개 API의 req/res DTO + AgentChatRequest + AgentSSEEvent re-export (envelope 없는 raw payload — 기존 클라이언트 호환)
  - `lib/`
    - `tiers.ts` ← `src/lib/tiers.ts` (pure)
- `apps/core/tsconfig.json`: `extends ./tsconfig.base.json`, `compilerOptions.composite=true`, `outDir`/`declaration` 미설정 (소스 직접 export).
- 모든 import 경로는 상대(`./`)로 작성, alias 미사용 (라이브러리이므로).

## 2. 완료 조건
- [ ] `apps/core/package.json` 이름 `@seabw/core`, `main: ./index.ts`
- [ ] `apps/core/index.ts`에서 `./types`, `./schemas`, `./config`, `./http`, `./lib/tiers` re-export
- [ ] `apps/core/http/api-response.ts`에 `ApiResponse<T>` 정의
- [ ] `apps/core/http/dto.ts`에 다음 타입 정의/재export: `PlanRequest`, `PlanResponse`, `PlanRehydrateRequest`, `PlanRehydrateResponse`, `MarketplaceYieldsResponse`, `MarketplacePlanRequest`, `MarketplacePlanResponse`, `PrecheckRequest`, `PrecheckResponse`, `PortfolioHealthResponse`, `AgentChatRequest`, `AgentSSEEvent`
- [ ] `pnpm --filter @seabw/core exec tsc --noEmit` exit 0
- [ ] core가 viem/wagmi/react/next 의존 없음

## 3. 롤백 방법
- `apps/core/` 디렉토리 삭제
- `package.json`에서 `@seabw/core` 참조 제거 (없으면 무시)

---

## Scope

### 신규 생성 파일
```
apps/core/index.ts
apps/core/http/api-response.ts
apps/core/http/dto.ts
apps/core/http/index.ts
apps/core/types/*.ts            # src/types/*.ts 복사
apps/core/types/index.ts
apps/core/schemas/*.ts          # src/schemas/*.ts 복사
apps/core/schemas/index.ts
apps/core/config/chains.ts      # src/config/chains.ts 복사
apps/core/config/index.ts
apps/core/lib/tiers.ts          # src/lib/tiers.ts 복사
apps/core/lib/index.ts
```

### 수정 대상 파일
```
apps/core/package.json          # Step 01의 placeholder에 zod 의존성 + exports 추가
apps/core/tsconfig.json
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| zod | 신규 의존성 (core) | schemas에 필요 |
| src/types, src/schemas, src/config, src/lib/tiers | 복사 원본 | src/ 보존 — 원본 수정 0 |

### Side Effect 위험
- 복사 누락 위험 (특히 types/yield-product.ts, types/index.ts 같이 cross-import) → `cp -r src/types apps/core/types` 같은 일괄 복사로 방지.
- types/schemas 내부에서 `@/*` alias 쓰는 경우 → 상대 경로로 치환 필요.

### 참고할 기존 패턴
- `/Users/mousebook/Documents/side-project/HypurrQuant_FE/packages/core/package.json` (exports 매핑)
- `/Users/mousebook/Documents/side-project/HypurrQuant_FE/packages/core/index.ts`

## FP/FN 검증

### FP
- `lib/tiers.ts` 외 다른 lib (예: risk.ts) — risk.ts는 portfolio 도메인 전용으로 server에 두는 것이 일관성 (web에서 안 씀). 제외.
- `lib/prices.ts` — server-only (HTTP fetch + defi-cli 의존). core 제외 → server.
- `lib/yields.ts` — server-only (외부 카탈로그 fetch). core 제외.

### FN
- `AgentChatRequest`, `AgentSSEEvent` 타입을 core에 넣는 것 — web이 직접 fetch SSE 할 가능성. ✅ 포함.
- `ApiResponse` envelope helper — `ok()`, `err()` 함수도 같이 — Step 03 server util에서 정의하지만 type 자체는 core. ✅ 포함.

### 검증 통과: ✅

# Step 08: apps/web (Next.js) — UI 이전 + HTTP wrapper

## 메타데이터
- **난이도**: 🟠 중간
- **롤백 가능**: ✅
- **선행 조건**: Step 02 (core), Step 05 (server endpoints)

---

## 1. 구현 내용

`src/app` (api 제외) + `src/components` + `src/state` + `src/lib/{wagmi,utils}` + `public/` 을 `apps/web/`로 복사. Next.js 설정 이전. 모든 fetch 호출을 `http.ts` wrapper로 통합 + base URL 환경분리.

### 디렉토리
- `apps/web/`
  - `package.json`: name `@seabw/web`, dependencies = 기존 루트의 Next/React/wagmi/viem/radix/lucide/clsx/tanstack/zustand 등 client 의존성 + `@seabw/core: workspace:*`
  - scripts: `dev: next dev -p 3000`, `build: next build`, `start: next start -p 3000`, `lint: next lint`, `test: vitest run`
  - `next.config.ts` ← 루트에서 이전 (rewrites 옵션 옵션적 추가 안 함)
  - `next-env.d.ts`, `postcss.config.mjs`, `tsconfig.json`, `tailwind.config.*`(있다면), `vitest.config.ts`
  - `public/` ← 루트에서 이전
  - `src/app/` ← `src/app/`에서 `api/` 디렉토리 제외하고 복사
  - `src/components/` ← `src/components/` 그대로
  - `src/state/` ← `src/state/` 그대로
  - `src/lib/wagmi.ts`, `src/lib/utils.ts` ← 그대로
  - `src/lib/http.ts` (신규)
  - `.env.local.example`: `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`

### http.ts (신규)
```ts
import type { ApiResponse } from '@seabw/core';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export async function http<T>(opts: {
  url: string;       // '/api/plan' 등
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT';
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}): Promise<T> {
  const res = await fetch(`${BASE}${opts.url}`, {
    method: opts.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  if (!res.ok) {
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('json')) {
      const env = (await res.json()) as ApiResponse<never>;
      if ('ok' in env && env.ok === false) throw new Error(env.error.message);
    }
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
```

### 기존 컴포넌트들의 fetch 호출 갱신
- `IntentInput.tsx`: `fetch('/api/plan', ...)` → `http<PlanResponse>({ url: '/api/plan', method: 'POST', body: req })`
- `BasketReview.tsx`: yields/plan 호출 동일하게 교체
- `SignFlow.tsx`: /api/precheck + /api/plan/rehydrate
- `PortfolioPage`: /api/portfolio/health

### 정리
- `src/app/api/` 는 apps/web 으로 복사하지 않음 (Next.js API Route 제거).
- 루트의 next 관련 파일들은 Step 10에서 삭제.

## 2. 완료 조건
- [ ] `apps/web/src/app/api/` 디렉토리 없음
- [ ] `apps/web/src/lib/http.ts` 존재 + ApiResponse 타입 사용
- [ ] `pnpm --filter @seabw/web build` exit 0
- [ ] `pnpm --filter @seabw/web dev` → http://localhost:3000/ 로딩 200
- [ ] 두 서버(4000/3000) 동시 부팅 후 브라우저에서 골든 패스(intent 입력 → plan 표시) 동작
- [ ] `grep -rn "fetch(" apps/web/src/{components,app} | grep -vE "lib/http|public/" | wc -l` → 0
- [ ] `grep -rn "http<" apps/web/src | grep -E "http<(any|unknown)>" | wc -l` → 0
- [ ] core의 DTO 타입을 import 사용 (loose any 금지)

## 3. 롤백 방법
- `apps/web/` 디렉토리 삭제 → 루트의 src/는 보존되어 있으므로 `next dev`로 기존 동작 복원

---

## Scope

### 신규 생성 파일
```
apps/web/package.json
apps/web/next.config.ts
apps/web/postcss.config.mjs
apps/web/tsconfig.json
apps/web/next-env.d.ts
apps/web/vitest.config.ts
apps/web/.env.local.example
apps/web/src/lib/http.ts
apps/web/public/                         # ← 루트 public 복사
apps/web/src/app/{layout,page,error,globals.css 등}.tsx   # ← src/app 복사 (api 제외)
apps/web/src/app/portfolio/page.tsx       # 동일
apps/web/src/app/risks/page.tsx           # 동일
apps/web/src/components/*.tsx             # 동일
apps/web/src/state/*.ts                   # 동일
apps/web/src/lib/{wagmi,utils}.ts
```

### 수정 대상 파일
```
(apps/web 복사본의 모든 컴포넌트)        # fetch('/api/...') → http<T>({ url: '/api/...' })
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| Next.js 15, React | apps/web 의존 | 루트에서 이동 |
| wagmi, viem | client 의존 | 동일 |
| @seabw/core | workspace import | 타입 |

### Side Effect 위험
- env: dev에서 `NEXT_PUBLIC_API_BASE_URL` 미설정 시 same-origin → server에 도달 못 함. `.env.local.example` 명시 + README 안내.
- CORS: server가 `WEB_ORIGIN`(3000) 허용 — Step 03에서 처리됨.
- 정적 자산 경로 (`/images/...`)는 next public 경로 그대로 유지.

### 참고할 기존 패턴
- 참조 `apps/web/src/lib/http.ts` 또는 web 측 http wrapper 위치.

## FP/FN 검증

### FP
- src/app/api 복사 — 명시적으로 제외 ✅.
- src/lib/wagmi, utils 외 lib (prices, yields 등) — server-only, 복사 안 함 ✅.

### FN
- 모든 컴포넌트 fetch 호출 갱신 — grep 검증으로 보장 ✅.
- public/ 복사 — 명시 ✅.

### 검증 통과: ✅

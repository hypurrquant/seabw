# DoD - v1.2.2

## 기능 완료 조건

### Lint

| # | 조건 | 검증 방법 |
|---|------|----------|
| F1 | `apps/web/eslint.config.mjs` 존재 (flat config) | `[ -f apps/web/eslint.config.mjs ]` |
| F2 | `apps/web/package.json` 의 `lint` script 가 `next lint` 미사용 | `grep "next lint" apps/web/package.json` 0 hits |
| F3 | `pnpm --filter @seabw/web lint` 가 비대화형으로 exit 0 또는 명확한 error code (인터랙티브 프롬프트 X) | 명령 실행 → exit code 명확 |
| F4 | `--max-warnings=0` 적용 | `grep "max-warnings" apps/web/package.json` 1+ hit |

### E2E

| # | 조건 | 검증 방법 |
|---|------|----------|
| F5 | `playwright.config.ts` 에 `@seabw/server` 참조 0 | `grep "@seabw/server" playwright.config.ts` 0 hits |
| F6 | 루트 `package.json` 의 default scripts (typecheck/lint/test/build) 가 e2e 호출 없음 | `grep "test:e2e" package.json` 결과 점검 — default chain 에 없음 |

### Workspace + CI

| # | 조건 | 검증 방법 |
|---|------|----------|
| F7 | `pnpm-workspace.yaml` 의 외부 path 참조 보존 (정책 그대로) | `grep "side-project" pnpm-workspace.yaml` 1 hit |
| F8 | `.github/workflows/ci.yml` 존재 + HQ worktree clone step 포함 | `[ -f .github/workflows/ci.yml ] && grep "HypurrQuant_FE" .github/workflows/ci.yml` 1+ hit |
| F9 | CI workflow 가 typecheck / lint / test / build 4 gate 실행 | yaml 의 steps grep |
| F10 | CI workflow 가 e2e job 없음 | `grep "playwright\|test:e2e" .github/workflows/ci.yml` 0 hits |

### Env

| # | 조건 | 검증 방법 |
|---|------|----------|
| F11 | `.env.example` 에 `NEXT_PUBLIC_HQ_ORIGIN` 추가 | `grep "NEXT_PUBLIC_HQ_ORIGIN" .env.example` 1 hit |
| F12 | `.env.example` 에 `NEXT_PUBLIC_HQ_BASE_URL` 추가 | `grep "NEXT_PUBLIC_HQ_BASE_URL" .env.example` 1 hit |
| F13 | `.env.example` 에서 `DEFI_PRIVATE_KEY` 제거 (사용처 0 audit 완료) | `grep "DEFI_PRIVATE_KEY" .env.example apps/web/src` 0 hits |
| F14 | `.env.example` 에 prod 강제 변수 주석 안내 (DEFIPILOT_DEMO_BANNER=false, NEXT_PUBLIC_DEFIPILOT_ENV=prod, NEXT_PUBLIC_DEFAULT_CHAIN_ID=999) | 파일 내 주석 grep |

### Prod env 강제

| # | 조건 | 검증 방법 |
|---|------|----------|
| F15 | `apps/web/next.config.ts` 가 build phase 에서 `NEXT_PUBLIC_DEFIPILOT_ENV=prod` 시 demo banner / chain id 검증 | `grep "DEFIPILOT_DEMO_BANNER\|NEXT_PUBLIC_DEFAULT_CHAIN_ID" apps/web/next.config.ts` 2+ hits |
| F16 | prod env 위반 시 build throw (S4 시연) | 수동 — DEFIPILOT_DEMO_BANNER=true && env=prod build → fail |
| F17 | demo env 는 통과 (S2) | 수동 |

### HQ audit (worktree)

| # | 조건 | 검증 방법 |
|---|------|----------|
| F18 | HQ worktree apps/server src 에 `AGENT_AUTH_DEV_BYPASS` 사용 0 (또는 발견 시 별도 commit 으로 제거) | `grep "AGENT_AUTH_DEV_BYPASS" /Users/mousebook/Documents/side-project/HypurrQuant_FE/worktrees/seabw-integration/apps/server/src` 결과 |

## 비기능 완료 조건

| # | 조건 | 검증 방법 |
|---|------|----------|
| N1 | `pnpm typecheck` 통과 | exit 0 |
| N2 | `pnpm test` 통과 (기존 unit test 모두 green) | exit 0 |
| N3 | `pnpm build` (demo env) 통과 | exit 0 |
| N4 | `pnpm lint` 통과 (비대화형, exit 0) | exit 0 |
| N5 | 신규 npm 의존성: `eslint`, `eslint-config-next` 만 (또는 이미 있음). 그 외 0 | `git diff package.json` |
| N6 | CLAUDE.md 의 "현재 페이즈" 갱신 (v1.2.2) | head CLAUDE.md |
| N7 | PROGRESS.md 모든 Step ✅ | 파일 확인 |
| N8 | 본 phase 산출 commit prefix 일관 (`chore:` 또는 `ci:`) | `git log --oneline -5` |

## 엣지케이스

| # | 시나리오 | 기대 동작 | 검증 방법 |
|---|---------|----------|----------|
| E1 | next 16 출시 후 `next lint` 완전 제거 | 본 phase 변경이 이미 ESLint CLI 기반이라 영향 없음 | (장기) |
| E2 | CI 에서 HQ worktree clone 권한 누락 | workflow step 명확히 fail + README/workflow 코멘트가 secret 설정 안내 | 수동 — token 없는 환경에서 dry-run |
| E3 | 로컬 dev `.env.local` 가 prod=demo 인 상태에서 prod build 시도 | next.config throw — `NEXT_PUBLIC_DEFIPILOT_ENV` 가 prod 라야 한다는 메시지 또는 demo banner 가 set 잘못됐다는 메시지 | 수동 (S4) |
| E4 | DEFI_PRIVATE_KEY 가 grep 0 이지만 환경 변수로는 사용 가능성 (`process.env.DEFI_PRIVATE_KEY`) | grep 으로 0 — 안전. 사용자 추가 audit 권장 1줄 보고 | grep |
| E5 | playwright config 에서 `@seabw/server` 제거 후 `pnpm test:e2e` 실행 | e2e suite 자체는 본 phase 외라 통과/실패 무관. config load 만 검증 | `npx playwright test --list` (또는 skip) |
| E6 | CI workflow 가 push 시점에 fork 에서 secret 미접근 | PR 인 경우 secret 미접근으로 HQ clone fail — fork 대응 정책 명시 | workflow 코멘트 |
| E7 | HQ worktree 가 로컬 path 에 없는 신규 dev 가 setup | README 의 부팅 절차에 worktree 경로 명시 (CLAUDE.md 에 이미 있음) | docs 확인 |
| E8 | demo 빌드 시 HYPEREVM_RPC_URL 빈값 | 통과. 런타임에 wallet 호출 시 wagmi 가 다른 chain 사용 | 수동 |
| E9 | prod 빌드 시 HYPEREVM_RPC_URL 빈값 | next.config 가 throw (선택적) — 또는 dependency check script 가 warn | 결정: 본 phase 는 warn 만 (throw 까지 가면 dev 에서 실수 위험) |

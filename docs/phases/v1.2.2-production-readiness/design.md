# 설계 - v1.2.2

## 변경 규모
**규모**: 운영 리스크
**근거**:
- 인증/권한 변경 (HQ side audit, prod env 강제) — 자동 승격.
- 인프라 변경 (CI pipeline 신설, workspace 정책 변경) — 프로덕션 배포 영향.
- env 변수 마이그레이션 — 호환성 깨짐.
- 다수 파일 수정 + 신규 파일 (eslint config, github workflows, env example).

---

## 문제 요약
v1.2.1 까지 기능은 완성됐지만 **CI 부재 / workspace 외부 참조 / lint 깨짐 / e2e 깨짐 / env 혼란 / demo flag 미강제** 6 개 차단점이 production-ready 판정을 막음. 단일 PR 로 7 개 차단점을 해결 (1 개는 OOS).

> 상세: [README.md](README.md).

## 접근법

1. **Lint** — `next lint` 폐기, `eslint` CLI + `eslint-config-next` 사용. `eslint.config.mjs` flat config. `pnpm lint` 가 비대화형 exit.
2. **E2E** — `pnpm test:e2e` 를 default script 에서 빼고 별도 script (`test:e2e:manual`) 로 보관. playwright config 의 `@seabw/server` line 삭제 또는 주석. CI 에서는 호출 X.
3. **Workspace** — `pnpm-workspace.yaml` 그대로. CI workflow 의 setup step 에서 `git clone --branch feat/seabw-integration <HQ_REMOTE> ../../side-project/HypurrQuant_FE/worktrees/seabw-integration` (또는 mock packages 생성). 로컬 개발 경로는 그대로 동작.
4. **Env** — 루트 `.env.example` 갱신:
   - 추가: `NEXT_PUBLIC_HQ_ORIGIN`, `NEXT_PUBLIC_HQ_BASE_URL`
   - 강제 prod 값 명시 (주석): `NEXT_PUBLIC_DEFIPILOT_ENV=prod`, `DEFIPILOT_DEMO_BANNER=false`, `NEXT_PUBLIC_DEFAULT_CHAIN_ID=999`
   - 제거: `DEFI_PRIVATE_KEY` (사용처 0 audit 완료 가정 — Step 5 에서 grep 으로 재확인)
   - HyperEVM RPC 필수화 — `HYPEREVM_RPC_URL` 가 빈값이면 build script 가 warn (강제는 next.config 또는 별도 check 스크립트).
5. **Demo flag 강제** — `apps/web/next.config.ts` 의 build phase 에서:
   ```ts
   if (process.env.NEXT_PUBLIC_DEFIPILOT_ENV === 'prod') {
     if (process.env.DEFIPILOT_DEMO_BANNER !== 'false') throw new Error('DEFIPILOT_DEMO_BANNER must be "false" when env=prod');
     if (process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID !== '999') throw new Error('Prod chain must be 999 (HyperEVM)');
   }
   ```
6. **CI** — `.github/workflows/ci.yml` 신규:
   - trigger: push, pull_request
   - jobs: `verify` (HQ worktree clone → pnpm install → typecheck → lint → test → build)
   - e2e job 없음.
7. **HQ audit** — `grep "AGENT_AUTH_DEV_BYPASS" <worktree>` 0 확인. 발견 시 worktree 에서 별도 commit 으로 제거.
8. **DEFI_PRIVATE_KEY audit** — `grep "DEFI_PRIVATE_KEY" apps/web/src` 0 확인. 0 이면 `.env.example` 에서 제거.

## 대안 검토

### A. Lint 마이그레이션

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| A1. `next lint` 유지 + `--strict` flag | 변경 0 | next 16 에서 제거 예정, 현재 대화형 빠짐 | ❌ |
| **A2. ESLint flat config (`eslint.config.mjs`) + `eslint-config-next`** | next 권장, future-proof, 비대화형 | flat config 학습곡선 | ✅ |
| A3. `.eslintrc.json` legacy | 익숙함 | ESLint 9 에서 deprecated, 추가 의존성 (`@eslint/eslintrc`) | ❌ |

**선택 이유 (A2)**: Next.js 공식 권장. ESLint 9 와 미래 호환.

### B. Workspace 재현성

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| B1. HQ 패키지 npm publish | 가장 깨끗 | HQ 팀 협의/CI 필요, 즉시 불가 | ❌ |
| B2. git submodule | 표준 패턴 | submodule init 복잡, worktree 경로 의존 | ❌ |
| **B3. CI 에서 명시적 clone step + workspace.yaml 그대로** | 로컬 경험 변화 0, CI 만 변경 | CI script 가 절대 경로 가정 — 다른 CI provider 이식성 ↓ | ✅ |
| B4. 패키지 vendor (복사) | 즉시 작동 | drift 위험 큼 | ❌ |

**선택 이유 (B3)**: 사용자 사전 결정. 로컬 개발자 onboarding 변화 0.

### C. Demo flag 강제 방식

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| C1. docs 안내만 (강제 X) | 코드 변경 0 | 실수 가능 | ❌ |
| **C2. next.config build-time throw** | 빌드 단계에서 fail-fast | next.config 가 server only — client env 검증 가능한지 점검 필요 | ✅ |
| C3. 런타임 component check (DemoBanner 가 prod 에서 throw) | 런타임에서도 catch | UX 깨짐, deploy 후에야 발견 | ❌ |

**선택 이유 (C2)**: `process.env` 가 next.config 에서 접근 가능. build 시 catch.

### D. E2E 처리

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| D1. apps/server slim proxy 신규 | playwright config 그대로 | scope 폭증, OOS | ❌ |
| **D2. playwright config 에서 `@seabw/server` line 제거 + e2e suite skip** | 본 phase scope 정합 | e2e gate 부재 — 후속 phase 책임 | ✅ |
| D3. playwright config 전체 삭제 | 깔끔 | 후속 phase 에서 재작성 비용 | ❌ |

**선택 이유 (D2)**: 사용자 사전 결정. e2e 자체는 후속 phase.

## 기술 결정

- **ESLint config**: `apps/web/eslint.config.mjs` (flat config). next 권장 ruleset (`next/core-web-vitals`).
- **package.json scripts**:
  - `"lint": "eslint . --max-warnings=0"` (또는 `next lint` 의존 제거 + `eslint . --max-warnings=0`)
  - `"test:e2e"` 는 root 에서 제거 — `"test:e2e:manual"` 로 보관 (옵션).
- **next.config build-time validation**: `next.config.ts` top-level 에 `if (env==='prod') {...}` 블럭.
- **CI**: GitHub Actions. node 22, pnpm 9. cache: pnpm store. HQ clone 은 별도 step.
- **CI 의 HQ clone secret**: HQ repo 가 private 라면 `GITHUB_TOKEN` 또는 별도 `HQ_CLONE_TOKEN` secret. 본 phase 는 secret 이름만 명시, 실제 token 등록은 사용자.
- **NEXT_PUBLIC_DEFAULT_CHAIN_ID=999** prod 강제. 다른 값은 demo/dev.
- **`.env.example`** 의 default value 는 demo 유지 (로컬 onboarding 우선).

---

## 범위 / 비범위

### 범위 (In Scope)
- `apps/web/eslint.config.mjs` 신규.
- `apps/web/package.json` scripts 수정 (lint).
- `apps/web/next.config.ts` build-time env validation 추가.
- 루트 `.env.example` 갱신 (변수 추가/제거/주석).
- `playwright.config.ts` `@seabw/server` line 제거.
- `.github/workflows/ci.yml` 신규.
- `apps/web/src/components/demo-banner.tsx` — 그대로 (이미 env 분기 있음).
- DEFI_PRIVATE_KEY grep audit.
- HQ worktree 의 `AGENT_AUTH_DEV_BYPASS` 사용 여부 grep audit (변경은 발견 시에만).

### 비범위 (Out of Scope)
README.md 참조.

## 가정 / 제약
- HQ worktree 가 `/Users/mousebook/Documents/side-project/HypurrQuant_FE/worktrees/seabw-integration` 에 존재 (로컬 dev).
- ESLint 9 와 `eslint-config-next` 호환 (next 15 에 번들).
- next.config.ts 에서 `process.env` 가 build phase 에 접근 가능.
- pnpm 9, node 22 가 CI 에서 가용.

## 아키텍처 개요

### Lint 흐름 (After)
```
$ pnpm --filter @seabw/web lint
  → apps/web/eslint.config.mjs 로드
  → ./src/**/*.{ts,tsx} 검사
  → 0 error, 0 warning → exit 0 (CI 통과)
```

### Build 흐름 (Prod)
```
NEXT_PUBLIC_DEFIPILOT_ENV=prod NEXT_PUBLIC_DEFAULT_CHAIN_ID=999 \
DEFIPILOT_DEMO_BANNER=false ... pnpm --filter @seabw/web build
  → next.config.ts top-level env 검증
  → 위반 시 throw → build fail
  → 통과 시 normal next build
```

### CI 흐름
```
push/PR
  ↓
checkout seabw
  ↓
checkout HQ worktree (../../side-project/...) ← 별도 step
  ↓
setup node + pnpm + cache
  ↓
pnpm install (workspace resolve)
  ↓
parallel: typecheck / lint / test / build
  ↓ all green
PR check ✅
```

## 데이터 흐름
N/A — 인프라 변경.

## API / 인터페이스 계약
- 외부 API 계약 변경 없음.
- `.env.example` 변경은 onboarding 영향 — 마이그레이션 노트 README 에 1줄 추가.

## 데이터 모델 / 스키마
N/A.

## 테스트 전략

### 자동
- 신규 unit test 없음 (인프라 변경).
- `pnpm typecheck` / `pnpm build` 가 next.config 의 prod validation 까지 커버.

### 수동
- **S1. Lint 통과**: `pnpm --filter @seabw/web lint` → exit 0, 비대화형.
- **S2. Demo build**: `NEXT_PUBLIC_DEFIPILOT_ENV=demo pnpm --filter @seabw/web build` → 통과.
- **S3. Prod build (정상)**: 4 변수 다 prod-valid 값으로 build → 통과.
- **S4. Prod build (위반)**: `NEXT_PUBLIC_DEFIPILOT_ENV=prod DEFIPILOT_DEMO_BANNER=true` → build fail 에 명확한 에러 메시지.
- **S5. CI dry-run**: GitHub Actions tab 또는 `act` 로 workflow 실행 — green 확인.
- **S6. HQ audit**: `grep "AGENT_AUTH_DEV_BYPASS" <worktree>/apps/server/src` 결과 사용자 확인.
- **S7. DEFI_PRIVATE_KEY audit**: `grep "DEFI_PRIVATE_KEY" apps/web/src` 0 hits 확인.

## 실패 / 에러 처리

| 시나리오 | 처리 |
|---|---|
| Prod env 위반 빌드 | next.config throw — 명확한 에러 메시지 + 어느 변수가 문제인지 |
| Lint 가 0 error 가 아닌 상태로 통과 | `--max-warnings=0` flag |
| CI 에서 HQ clone 실패 | workflow step fail 명확 표시. README 에 secret 설정 가이드 추가 |
| `.env.example` 변경 후 기존 dev 환경 깨짐 | local `.env.local` 은 변경 없음. example 변경은 신규 onboarding 만 영향 |

## 롤아웃 / 롤백

### 배포 순서
1. **PR 머지 (local)**: 본 phase 변경 develop 에 commit.
2. **CI 검증**: workflow 가 처음 돌 때 secret 누락 등 발견 가능 — 즉시 fix.
3. **Prod build 시연**: 사용자가 prod env 변수 set 하고 `pnpm build` 1회.
4. **Remote push**: 사용자 명시 요청 시 (현재 P0-8 보류 항목).

### 롤백
- `git revert <commit>` — 단일 PR 이라 일괄 revert 가능.
- 영향 범위: lint 가 다시 깨짐, CI workflow disable.

## 관측성
- CI workflow 의 각 step log.
- next.config validation throw 시 stack trace.

## 보안 / 권한

- `DEFI_PRIVATE_KEY` 가 `.env.example` 에 남아있는 것 자체가 보안 약점 — audit 후 제거.
- `AGENT_AUTH_DEV_BYPASS` 가 worktree env / spec 에 남아있으면 prod 컨테이너에 누설 위험 — grep 으로 확인.
- CI secret (`HQ_CLONE_TOKEN`) 은 repo settings 에 등록. workflow 에는 이름만.
- demo flag 강제는 "prod 환경에서 demo UI 노출" 사고 방어.

## 성능 / 스케일
N/A.

## 리스크 / 오픈 이슈

| ID | 항목 | 영향 | 대응 |
|---|---|---|---|
| R1 | ESLint 9 + next 15 의 `eslint-config-next` 호환 이슈 | lint 가 다시 fail | 설정 후 즉시 `pnpm lint` 실행으로 검증. 실패 시 next 권장 config 따라가기 |
| R2 | next.config build-time validation 이 CI 에서 prod env 미설정 시 build fail | CI 가 항상 fail | CI 는 `NEXT_PUBLIC_DEFIPILOT_ENV=demo` 로 build (production deploy job 만 prod 강제) |
| R3 | CI 의 HQ clone 이 private repo 권한 미설정 | workflow fail | secret 가이드를 README 와 workflow 코멘트 양쪽에 |
| R4 | `.env.example` 변경이 신규 onboarding 깨뜨림 | DX 저하 | 마이그레이션 노트 1줄 + CLAUDE.md 의 "부팅" 절 점검 |
| R5 | playwright config 의 `@seabw/server` line 만 제거하면 e2e suite 자체가 fail | OOS 라 문제 안 됨 | `test:e2e` script 자체를 제거하거나 `:manual` 로 rename |
| R6 | HQ worktree 의 `AGENT_AUTH_DEV_BYPASS` 가 실제로 남아있음 | seabw scope 외 | 발견 시 worktree 별도 commit, prefix `[seabw]` |
| R7 | DEFI_PRIVATE_KEY 가 실제로 어디선가 import (현재 grep 0) | 누락 시 prod break | audit 신중히, 1차 grep + 2차 dependency tree 확인 |
| R8 | CI 의 prod build job 이 secret 누락 시 fail 무한 반복 | 노이즈 | workflow 에 prod build job 은 별도 conditional (tag/branch trigger) |

### 오픈 이슈
- O1: CI 에 prod build job 을 별도 두지 않고, `verify` job 만 demo env 로 돌릴지 — **결정**: 본 phase 는 verify 만. prod build 는 deploy phase 에서.
- O2: HyperEVM RPC URL 빈값일 때 build 가 통과해야 하는지 — **결정**: prod 강제 시 빈값이면 throw, demo 는 통과.

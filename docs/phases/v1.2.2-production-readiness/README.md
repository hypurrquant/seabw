# Production Readiness - v1.2.2

## 문제 정의

### 현상
- v1.2.1 완료 시점 기준, seabw 는 기능적으로 LP 추천 → 카드 → wagmi 서명 종단 경로가 동작하지만 **production-ready 판정 불가**:
  - `pnpm lint` 가 next 15 의 deprecated `next lint` 대화형 프롬프트로 빠져 CI 차단.
  - `pnpm test:e2e` 가 존재하지 않는 `@seabw/server` workspace 를 띄우려 해 실패.
  - `pnpm-workspace.yaml` 이 repo 밖 `../../side-project/HypurrQuant_FE/worktrees/seabw-integration/packages/*` 를 참조 — CI/Docker 환경에서 재현 불가.
  - 코드가 사용하는 `NEXT_PUBLIC_HQ_ORIGIN`, `NEXT_PUBLIC_HQ_BASE_URL` 가 `.env.example` 에 누락. `DEFI_PRIVATE_KEY` 같은 위험 변수가 예시에 박혀있음.
  - prod 가정과 어긋난 default (`DEFIPILOT_ENV=demo`, `NEXT_PUBLIC_DEFIPILOT_ENV=demo`, `DEFIPILOT_DEMO_BANNER=true`).
  - `.github/workflows/` 디렉토리 자체 부재 — CI pipeline 0 개.
  - `develop` 이 `origin/develop` 보다 9 커밋 앞섬 — push 안 된 작업물.

### 원인
- v1.0.0~v1.2.1 동안 기능 구현 우선. 운영 정리 의도적 deferred.
- HQ 패키지 통합(v1.2.1 2차) 을 workspace 외부 참조로 빠르게 처리 — 로컬 데모 전제.
- v1.1.0 에서 `apps/server` 삭제 후 playwright config 갱신 누락.

### 영향
- **배포 차단**: CI 가 없어 변경마다 회귀 위험 방어막 없음.
- **타인이 clone → build 불가**: workspace path 가 절대-상대 경로로 외부를 가리킴.
- **운영 사고 위험**: demo banner / dev bearer / 임시 chain 이 prod 에 혼입될 가능성.
- **작업물 손실 위험**: 9 커밋이 로컬에만 존재.

### 목표
1. **Lint gate 복원** — next lint 의존 제거, ESLint CLI 기반으로 마이그레이션, 비대화형 동작 보장.
2. **E2E gate 정리** — playwright config 의 `@seabw/server` 참조 제거. e2e suite 는 본 phase scope 외 (skip).
3. **Workspace 재현성** — 현 구조 유지하되, CI 가 HQ worktree 를 명시적으로 clone 하는 step 추가.
4. **Env 정합성** — 코드가 사용하는 모든 `NEXT_PUBLIC_*` 와 server-side 변수를 `.env.example` 에 정렬, prod 강제 변수 분리.
5. **Prod chain 확정** — HyperEVM 단일 (`chainId=999`). RPC URL 필수화.
6. **Demo flag 검증** — prod 빌드 시 `NEXT_PUBLIC_DEFIPILOT_ENV=prod`, `DEFIPILOT_DEMO_BANNER=false` 강제. 다른 값이면 build fail.
7. **CI pipeline 신규** — `.github/workflows/ci.yml`: HQ worktree clone → install → typecheck → lint → test → build 5 gate.
8. **Backend auth bypass audit (HQ)** — worktree 의 `AGENT_AUTH_DEV_BYPASS` env 가 prod 컨테이너 spec 에서 제거된 상태인지 확인.
9. **DEFI_PRIVATE_KEY audit** — 코드 사용처 0 확인 후 `.env.example` 에서 제거.

### 비목표 (Out of Scope)
- ❌ **E2E 테스트 suite 자체 작성/복원** — playwright config 정리만, 실제 e2e 통과는 후속 phase.
- ❌ **apps/server 재도입** — slim proxy 도 안 만듬. seabw 는 web only.
- ❌ **HQ 패키지 npm publish** — workspace 외부 참조 유지.
- ❌ **다중 chain 지원** — HyperEVM 단일. Base/baseSepolia 코드는 남지만 prod env 에서 unsupported.
- ❌ **chain selector UI** — wagmi config 의 SUPPORTED_CHAINS 는 그대로 두되 prod default 만 강제.
- ❌ **Observability/Sentry 도입** — console log 수준 유지.
- ❌ **Security pass** (CSP, rate limit) — 별도 phase.
- ❌ **Remote push 자동화** — `develop` push 는 사용자 명시 요청 시에만.
- ❌ **Build warning 정리** (viem/ox tempo critical dependency warning) — 배포 차단 아니므로 후속.
- ❌ **Wallet flow smoke 자동화** — 수동 검증 항목으로 dod 에 남김.
- ❌ **HQ smoke 자동화** — 수동 검증 항목.

## 제약사항

### 시간
- 단일 PR 사이즈로 마감. 본 phase 종료 후 별도 push.

### 기술
- next 15 + ESLint 9 — `eslint.config.mjs` (flat config) 또는 `.eslintrc.json` 호환성 점검 필요. Next.js 권장은 flat config.
- 의존성 추가는 ESLint 관련 최소화 (`eslint`, `eslint-config-next` 만).
- HQ 패키지가 react 18 peerDep 이라 next 15(react 19) 와 peer 경고 발생 — 무시.
- `.env.example` 변경은 호환성 깨지므로 명확한 마이그레이션 노트 필요.

### 비즈니스
- 로컬 데모 안 깨야 함 — `NEXT_PUBLIC_DEFIPILOT_ENV=demo` default 유지, prod 강제는 build flag 기준.
- HQ worktree 정책 (`feat/seabw-integration` 만 사용) 유지.

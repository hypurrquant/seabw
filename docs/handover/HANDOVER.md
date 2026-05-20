# 작업위임서 — Wallet Auth · Header Connect · URL 라우팅 영속화

> 데모용 in-memory 흐름을 실제 멀티페이지 앱처럼 만들기 위한 3개 작업: ① 유저 지갑 인증 모듈, ② 상단 헤더에 지갑 연결 UI, ③ 설문 결과 화면을 URL 경로 + query parameter로 영속화.

---

## 6하원칙

### Who (누가)
- 다음 세션 누구든.
- 권한: 코드 수정, `pnpm dev`/`pnpm test` 가능 환경.

### What (무엇을)

#### Task 1 — 유저 Wallet Auth 모듈
- [ ] 지갑 주소를 신원으로 사용하는 SIWE(Sign-In With Ethereum) 또는 동등한 nonce-sign-verify 흐름 설계
- [ ] 서버측 인증 모듈 (`apps/server/src/domains/auth/` 신설): nonce 발급 → 서명 검증 → 세션/JWT 발급
- [ ] 클라이언트 hook (`apps/web/src/lib/auth.ts` 또는 `state/auth.tsx`): 연결된 지갑으로 자동 sign-in, 토큰 보관
- [ ] 기존 `AgentSession`, plan 호출이 사용자 신원과 묶이도록 정리 (현재는 익명 in-memory)
- [ ] 로그아웃 / 지갑 변경 시 세션 폐기

#### Task 2 — 상단 헤더 지갑 연결
- [ ] `apps/web/src/components/site-header.tsx` 오른쪽 nav에 지갑 연결 버튼/드롭다운 추가
- [ ] 비연결 시: "Connect wallet" 버튼 → wagmi connector 선택 메뉴
- [ ] 연결 시: 짧은 주소 + 체인 라벨 + 연결 해제
- [ ] Task 1 완료 후: 연결 직후 자동으로 SIWE 사인 트리거, auth 상태도 같이 표시
- [ ] 기존 `connect-wallet.tsx` 전용 페이지와의 관계 정리 (헤더로 통합 후 페이지는 제거할지, 유지할지)

#### Task 3 — 설문 결과의 URL 경로 + Query Parameter 영속화
- [ ] 현재 stage 기반 in-memory 라우팅(`AppStateProvider` reducer)을 **실제 URL 경로**로 전환
  - 예: `/` (landing), `/survey`, `/result`, `/intent`, `/marketplace`, `/plan`, `/portfolio`
- [ ] 설문 결과(tier/answers) 와 유저 선택(mode 등)을 query parameter에 인코딩
  - 예: `/result?tier=balanced&score=18&...` , `/intent?mode=robo` 등
- [ ] refresh / 공유 / 뒤로가기 모두 동작하도록
- [ ] `AppStateProvider`는 URL을 single source of truth로 두고, mount 시 URL 읽어 hydrate
- [ ] 잘못된/위조된 query는 Zod 검증 후 landing으로 fallback
- [ ] e2e (`survey-marketplace-flow`, `survey-robo-flow`, `tier-downgrade`) 회귀 점검

### When (언제)
- 선행 조건: 없음. 즉시 가능.
- 권장 순서: **Task 3 → Task 2 → Task 1**
  - 3을 먼저 해야 URL 기반 페이지가 생겨서 헤더가 일관되게 동작
  - 2는 3 위에서 자연스럽게 얹힘
  - 1은 마지막 — 인증은 UI가 안정된 뒤에 붙이는 게 안전
- 기한 없음.

### Where (어디서)

#### Task 1
- 신규: `apps/server/src/domains/auth/` (controller, service, module)
- 신규: `apps/core/http/dto.ts` 에 `AuthNonceRequest/Response`, `AuthVerifyRequest/Response`
- 신규: `apps/web/src/state/auth.tsx` 또는 `lib/auth.ts`
- 수정: `apps/server/src/domains/agent/infrastructure/dev-stub-auth.adapter.ts` → 실제 SIWE 검증으로 대체 또는 prod 어댑터 신설

#### Task 2
- 수정: `apps/web/src/components/site-header.tsx`
- 신규: `apps/web/src/components/header-wallet.tsx` (이전에 만들었다 revert 한 것)
- 참조: `apps/web/src/components/connect-wallet.tsx` (기존 페이지 — 유지/제거 결정)

#### Task 3
- 수정: `apps/web/src/state/app-state.tsx` (reducer + URL sync)
- 신규/수정: `apps/web/src/app/{survey,result,intent,marketplace,plan,portfolio}/page.tsx` (App Router 경로 추가)
- 신규: `apps/web/src/state/url-sync.ts` (Zod 인코딩/디코딩)
- 수정: `apps/web/src/components/{survey,tier-result,...}.tsx` (stage dispatch → `router.replace`)
- 참조: `apps/core/lib/tiers.ts:283` `TIER_CACHE_KEY` localStorage 캐시와 우선순위 정리

### Why (왜)

- **Task 1**: 현재 익명. `AgentSession`이 in-memory + 클라이언트가 임의 sessionId 만들면 그만 → 인증/소유권 개념이 없어 운영 불가. 지갑 주소가 유일한 자연스러운 신원.
- **Task 2**: 지갑 연결이 `connect-wallet.tsx` 전용 페이지에만 있어서 다른 화면에선 상태가 안 보임. 헤더에 항상 보여야 사용자가 자기 연결 상태를 알 수 있음.
- **Task 3**: 지금 `AppStateProvider`는 `useReducer` in-memory만 사용. 새로고침하면 `landing`으로 리셋 → tier-result에서 새로고침하면 설문 처음부터. 또 URL 공유 불가, 뒤로가기 불가. `localStorage` 캐시(`cacheTier`)는 있지만 Provider가 mount 시 안 읽음 (절반만 구현된 상태).

### How (어떻게)

#### Task 3 (먼저)
- App Router 경로 추가: 각 stage → 별도 `page.tsx`. `page.tsx` 라우터 switch는 제거.
- `AppStateProvider`는 그대로 두되 mount 시 `useSearchParams()`로 hydrate:
  ```ts
  function init(): AppState {
    const params = new URLSearchParams(window.location.search);
    return { ...INITIAL, ...decodeState(params) };
  }
  ```
- stage 전이는 `dispatch({ type: "GOTO" })` 대신 `router.push("/result?tier=balanced&score=18")`.
- query 스키마는 Zod로:
  ```ts
  const UrlStateSchema = z.object({
    tier: z.enum([...]).optional(),
    score: z.coerce.number().int().min(5).max(32).optional(),
    mode: z.enum(["robo","marketplace"]).optional(),
    ans: z.string().optional(),   // base64-json Answers (선택)
  });
  ```
- `plan` / `basket`처럼 큰 데이터는 URL 금지 — sessionStorage 또는 서버 재조회(`/api/plan/rehydrate` 이미 존재).

#### Task 2
- 클라이언트 컴포넌트 `HeaderWallet` 신설 → `SiteHeader`에 import.
- `mounted` 가드 (Providers가 client mount 이후 WagmiProvider 마운트하므로).
- 연결: 드롭다운으로 connector 목록. 연결 시: 짧은 주소 + 체인 + 끊기.
- Task 1 후: 연결 직후 `/api/auth/nonce` → `signMessage` → `/api/auth/verify` → 토큰 보관.

#### Task 1
- 표준 SIWE 흐름:
  1. `POST /api/auth/nonce { address }` → `{ nonce }` (서버가 nonce 저장, TTL 5분)
  2. 클라이언트가 EIP-4361 메시지 구성 + `personal_sign`
  3. `POST /api/auth/verify { address, signature, message }` → `{ token }` (JWT 또는 opaque)
  4. 이후 요청은 `Authorization: Bearer <token>`
- viem `verifyMessage` 사용. nonce 재사용 방지.
- 세션 스토어는 일단 in-memory로 두되 인터페이스 분리 (Redis 교체 가능하게).
- `agent` 도메인의 기존 `dev-stub-auth.adapter.ts`를 SIWE 어댑터로 교체하거나 prod 어댑터 추가.

워크플로우 제안: 각 Task를 **독립 PR**로. `/codex-phase-workflow` 또는 `/quick-phase-workflow`.

---

## 맥락

### 현재 상태
- 브랜치: `develop`
- 모노레포: `apps/{web,server,core}` (1.0.0 이후 Next.js 단일앱 → 모노레포 분할)
- 지갑 인프라: wagmi v2 + viem 이미 설치, `lib/wagmi.ts` 설정 존재, `connect-wallet.tsx` 전용 페이지 동작
- 라우팅: 모든 stage가 `apps/web/src/app/page.tsx`의 in-memory switch로 처리됨 (App Router 미활용)
- 인증: 익명. `AgentSession`은 클라이언트가 임의 sessionId 만들면 자동 생성

### 사용자 확정 결정사항
- **Report 보여주는 경로를 URL로** (Task 3) — refresh-safe + 공유 가능
- **유저 선택은 query parameter로** (Task 3) — mode, tier 등
- **헤더에 지갑 연결** (Task 2) — 전용 페이지가 아니라 항상 보이게
- **지갑 auth 필요** (Task 1) — 익명에서 벗어나기

### 미결정 (구현자가 사용자와 합의)
- Task 1: 토큰 형태 JWT vs opaque session? TTL?
- Task 2: 기존 `connect-wallet.tsx` 페이지 유지/제거?
- Task 3: 큰 데이터(plan/basket) 영속화 — sessionStorage / 서버 재조회 / 안 함 중 선택
- Task 3: URL에 Answers 전체를 base64로 실을지, 아니면 score+tier만 싣고 Answers는 localStorage 유지할지

### 참조
| 항목 | 경로 |
|---|---|
| 현재 stage 라우팅 | `apps/web/src/app/page.tsx` (in-memory switch) |
| State reducer | `apps/web/src/state/app-state.tsx` |
| Tier 캐시 (절반 구현) | `apps/core/lib/tiers.ts:283` `cacheTier/readCachedTier` |
| 지갑 인프라 | `apps/web/src/lib/wagmi.ts`, `components/providers.tsx` |
| 지갑 페이지 (참조) | `apps/web/src/components/connect-wallet.tsx` |
| 사이트 헤더 | `apps/web/src/components/site-header.tsx` |
| dev stub 인증 | `apps/server/src/domains/agent/infrastructure/dev-stub-auth.adapter.ts` |
| E2E 시나리오 | `e2e/survey-{marketplace,robo}-flow.spec.ts`, `tier-downgrade.spec.ts` |
| 관련 명세 | `docs/handover/ai-investor-profile-spec.md` (AI tendency 전달 — 별건) |

---

## 주의사항
- **권장 순서 지키기**: Task 3 → 2 → 1. URL 라우팅이 안 먼저 깔리면 헤더/인증이 stage state에 묶여서 다시 손봐야 함.
- **`router.replace` vs `push`**: stage 전이는 대부분 `replace` — 매 단계마다 히스토리 쌓이면 UX 망가짐.
- **`plan.calldata`는 URL에 절대 금지** — 크기도 크고 PII성. sessionStorage 또는 서버 재조회.
- **Wagmi mount 타이밍**: `Providers`가 mounted 이후에 `WagmiProvider`를 붙임 → `HeaderWallet`도 같은 mounted 가드 필요.
- **e2e 회귀**: stage 라우팅이 URL로 바뀌면 selector/assertion이 깨질 수 있음. URL 패턴 정한 직후 e2e 먼저 돌려서 baseline 갱신.
- **SIWE 메시지 포맷 일관성**: 클라이언트와 서버의 EIP-4361 메시지 빌드가 정확히 일치해야 검증 성공. 공유 헬퍼를 `apps/core`에 두는 게 안전.

## 시작 방법
1. `cd /Users/mousebook/Documents/hypurrquant/seabw && pnpm install`
2. baseline: `pnpm test && pnpm test:e2e`
3. **Task 3** 부터: `apps/web/src/state/url-sync.ts` 신설 → `AppStateProvider` URL hydrate → App Router 경로 분할 → e2e 갱신
4. **Task 2**: `HeaderWallet` 신설 → `SiteHeader` 통합 → wagmi mounted 가드
5. **Task 1**: `apps/server/.../auth/` 모듈 신설 → SIWE nonce/verify → 클라이언트 auth hook → 헤더에 인증 상태 표시
6. 각 Task 완료마다 별도 PR

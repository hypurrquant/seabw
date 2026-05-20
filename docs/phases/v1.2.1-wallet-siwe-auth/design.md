# 설계 - v1.2.1 Wallet SIWE Auth

## 변경 규모
**규모**: 운영 리스크
**근거**:
- 인증/권한 변경 (자동 승격 트리거).
- 데이터 모델 변경 (`AppState.auth` 슬롯 추가, `Stage` 순서 변경).
- 6개 파일 수정 + 신규 도메인 1개 + HQ guard/env 변경.
- 컨테이너 재기동 절차 포함 (로컬이지만 절차로 관리).

---

## 문제 요약

`apps/web/src/lib/hq-api.ts:18` 가 `Authorization: Bearer dev` 를 하드코딩하고 HQ 컨테이너의 `AGENT_AUTH_DEV_BYPASS=1` 에 의존 → wagmi 가 연결한 실제 지갑과 HQ session owner 가 분리됨. Stage 순서도 wallet 연결이 survey 이후로 밀려있어 dead-end UX. SiteHeader 에 wallet 상태 슬롯 없음.

> 상세: [README.md](README.md) 참조

## 접근법

1. **Challenge-Sign-Verify 3-step 흐름을 `useSiweAuth()` 훅으로 캡슐화**. ConnectWallet UI 는 wagmi `connect()` → 연결 후 `authenticate()` 1 클릭 → 훅이 challenge fetch → personal_sign → verify POST → 토큰 저장.
2. **AppState 의 `auth` 슬롯**에 token/expiresAt/ownerAddress/status 보관. `hq-api` 가 factory 패턴으로 token getter 주입받음.
3. **ConnectWallet 분리**: `ConnectWalletPanel` (presentational body) + `ConnectWalletStage` (풀-페이지 wrapper) + `ConnectWalletModal` (모달 wrapper). 헤더에서 modal 호출, stage flow 에선 stage wrapper.
4. **Stage 순서 재배치**: `landing → connect-wallet → survey → tier-result → chat`. survey 이하 stage 진입 시 reducer 가 `auth.status !== "authed"` 면 `connect-wallet` 으로 reroute.

## 대안 검토

### A. SIWE 라이브러리 vs 자체 challenge 문자열

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| A1. `siwe` npm 풀세트 (EIP-4361) | 표준 메시지 포맷, EIP-1271 (CA 지갑) 지원 | 60KB+ 번들, ethers 의존, HQ 도 동일 파서 필요 | ❌ |
| A2. HQ challenge 문자열 그대로 personal_sign | 의존성 0개, HQ 가 이미 그렇게 구현 | EIP-4361 미준수, EOA 만 | ✅ |

**선택**: A2. HQ `agent-auth.controller.ts` 가 이미 plain challenge 모델. 1-2h 안에 풀 SIWE 도입은 ROI 음수.

### B. 토큰 저장소

| 방식 | XSS 노출 | 새로고침 | 선택 |
|------|------|------|------|
| B1. zustand store | 메모리 한정 | 휘발 | ❌ |
| B2. React Context (AppState) | 메모리 한정 | 휘발 | ✅ |
| B3. localStorage | 모든 XSS 가 토큰 탈취 | 영속 | ❌ |
| B4. sessionStorage | XSS 가능 (덜 위험) | 탭 영속 | ❌ |

**선택**: B2. 이미 AppState reducer 가 있고 answers/tier 와 같은 라이프사이클로 묶기 자연스러움. 새로고침 = 재인증 1클릭, 해커톤 수용 가능.

### C. Stage 전이 시점

| 방식 | 흐름 | 선택 |
|------|------|------|
| C1. 현재 유지 (survey 후 wallet) | dead-end UX | ❌ |
| C2. landing → connect-wallet → survey → ... | wallet 게이트, profile 전 owner 확정 | ✅ |
| C3. 별도 라우트 `/connect` | reducer 와 router 두 SoT | ❌ |

### D. ConnectWallet 분리 형태

| 방식 | 선택 |
|------|------|
| D1. `mode: 'page' \| 'modal'` prop | ❌ (분기 if 많아짐) |
| D2. presentational `Panel` + wrapper 2종 | ✅ |
| D3. headless hook + 호출측 매번 짜기 | ❌ |

### E. Personal sign vs EIP-712

HQ 가 plain string verify 하도록 짜여있음. EIP-712 도입 시 양쪽 변경 → 범위 초과. **personal_sign 채택**.

## 기술 결정

- **wagmi 훅**: `useAccount`, `useConnect`, `useDisconnect`, `useSignMessage`.
- **토큰 저장소**: AppState (in-memory).
- **토큰 lifecycle**:
  - 발급: verify 응답 `{ token, expiresAt }` → `AUTH_VERIFIED` 액션.
  - 만료 체크: `hq-api` 호출 직전 `Date.now() >= expiresAt - 5000` 이면 `null` → caller 가 modal 트리거.
  - 무효화: HQ 401 / address 변경 / disconnect → `AUTH_RESET`.
  - silent refresh: **비범위**.
- **hq-api factory**: 모듈 스코프 상수 제거, `createHqClient({ getToken })` 패턴. provider 트리에서 1회 wiring.

---

## 범위 / 비범위

### 범위 (In Scope)
- SIWE challenge/sign/verify flow + `useSiweAuth` 훅.
- AppState 의 auth 슬롯 + 5개 신규 액션.
- Stage 순서 재배치.
- SiteHeader 에 wallet badge + connect/sign-in/sign-out 액션.
- ConnectWallet 분리 (Panel/Stage/Modal).
- `hq-api` 토큰 주입 리팩토링.
- HQ guard 의 `AGENT_AUTH_DEV_BYPASS` 분기 삭제 + 컨테이너 .env.local / compose 정리.
- 만료 토큰 시 재인증 모달.

### 비범위 (Out of Scope)
- silent refresh / refresh token.
- 영속 세션 (localStorage 토큰).
- EIP-4361 풀 준수, EIP-712.
- 멀티 계정 동시 인증, 토큰 revocation API.
- E2E 자동화.
- 다국어.

## 가정 / 제약

### 가정
- HQ `GET /auth/challenge` 가 사람이 읽을 수 있는 prefix 가 포함된 challenge 문자열 반환 (아니면 micro ticket 추가).
- HQ `POST /auth/verify` 가 `viem.recoverMessageAddress` 등으로 signer 검증 (이미 구현 가정).
- Challenge TTL 5분, token TTL 1시간 (HQ 정책 그대로).
- 사용자 단일 탭 사용.

### 제약
- 해커톤 — 의존성 추가 금지.
- 기존 wagmi config 변경 금지.
- HQ 동시 배포 (compose env 정리 포함).
- Next.js 15 App Router, "use client" 경계 유지.

## 아키텍처 개요

### Stage flow (변경 후)
```
landing
  │ Start
  ▼
connect-wallet  ← 이동
  │ wallet connect → SIWE sign-in
  ▼
survey
  │
  ▼
tier-result
  │
  ▼
chat  ← 여기서 token 으로 createSession(profile)
```

stage 진입 가드: `survey`, `tier-result`, `chat` 진입 시 `auth.status !== "authed"` → `GOTO connect-wallet`.

### 컴포넌트 트리
```
<Providers>                        WagmiProvider + QueryClient
  <AppStateProvider>
    <HqClientProvider>             신규: auth.token 으로 client 생성
      <SiteHeader>
        <WalletBadge/>             신규: status 별 UI + modal trigger
      </SiteHeader>
      <Router> ... </Router>
      <ConnectWalletModal>
        <ConnectWalletPanel variant="modal"/>
      </ConnectWalletModal>
    </HqClientProvider>
  </AppStateProvider>
</Providers>
```

## 데이터 흐름

### 시퀀스 (행복 경로)
```
User → Panel: click Connect
Panel → wagmi.connect()
wagmi → wallet popup → approve
effect: AUTH_WALLET_CONNECTED

User → Panel: click Sign in
Panel → useSiweAuth.authenticate()
  ↓ AUTH_STARTED
  ↓ GET /agent/auth/challenge?address → { challenge }
  ↓ signMessageAsync({ message: challenge }) → signature
  ↓ POST /agent/auth/verify { address, challenge, signature } → { token, expiresAt }
  ↓ AUTH_VERIFIED + GOTO survey
```

### 토큰 attach (chat 진입)
```
Chat → HqClient.createSession({ profile })
  → getToken() → "eyJ..."
  → POST /agent/sessions Authorization: Bearer ... body: { profile }
  → HQ guard.verify(token) → session.owner = decoded.address
  → { sessionId }
```

### 만료 / 401 처리
```
hq-api fetch → 401 → throw HqUnauthorizedError
→ caller catch → AUTH_RESET → open ConnectWalletModal
→ 사용자 Sign in 다시 → 새 token → caller 수동 retry
```

## API/인터페이스 계약

### `GET /api/v1/agent/auth/challenge?address=0x...`
```json
200: { "data": { "challenge": "DefiPilot wants you to sign in.\nAddress: 0x...\nNonce: ...\nIssued At: ..." } }
400: invalid address
```

### `POST /api/v1/agent/auth/verify`
```json
body: { "address": "0x...", "challenge": "...", "signature": "0x..." }
200: { "data": { "token": "eyJ...", "expiresAt": 1747700000000 } }
401: signature mismatch / challenge expired
400: malformed
```

### `/api/v1/agent/*` (기존)
모든 엔드포인트에 `Authorization: Bearer <token>` 필수. 없거나 무효면 401.

### HQ 변경
- `agent-auth.guard.ts` 의 `AGENT_AUTH_DEV_BYPASS` 분기 **삭제**.
- `.env.local` 에서 `AGENT_AUTH_DEV_BYPASS=1`, `AGENT_AUTH_DEV_WALLET` 제거.
- `CORS_ORIGIN` 에 `http://localhost:3000` 포함.
- `docker-compose.local.yml` 에 `AGENT_SYSTEM_PROMPT_FILE` 마운트 추가 (v1.2.0 산출물 살림).

## 데이터 모델 (AppState 확장)

```diff
+export type AuthStatus =
+  | "idle"           // 미연결
+  | "connected"      // 지갑은 붙음, 토큰 없음
+  | "authenticating" // challenge/sign/verify 진행 중
+  | "authed"         // 토큰 유효
+  | "error";
+
+export interface AuthState {
+  status: AuthStatus;
+  ownerAddress?: `0x${string}`;
+  token?: string;
+  tokenExpiresAt?: number;
+  error?: string;
+}

 export type Stage =
   | "landing"
+  | "connect-wallet"   // 이동: survey 앞으로
   | "survey"
   | "tier-result"
-  | "connect-wallet"
   | "chat";

 export interface AppState {
   stage: Stage;
   answers?: Answers;
   tier?: TierResult;
+  auth: AuthState;
   lastError?: string;
 }

 const INITIAL: AppState = {
   stage: "landing",
+  auth: { status: "idle" },
 };

 type Action =
   | { type: "GOTO"; stage: Stage }
   | { type: "SET_ANSWERS"; answers: Answers }
   | { type: "SET_TIER"; tier: TierResult }
   | { type: "ERROR"; message: string }
   | { type: "RESET" }
+  | { type: "AUTH_WALLET_CONNECTED"; address: `0x${string}` }
+  | { type: "AUTH_STARTED" }
+  | { type: "AUTH_VERIFIED"; address: `0x${string}`; token: string; expiresAt: number }
+  | { type: "AUTH_FAILED"; error: string }
+  | { type: "AUTH_RESET" };
```

## 테스트 전략

자동 테스트는 최소화 — 해커톤 시간 우선. 수동 시연 시나리오 위주.

### S1. 행복 경로
1. 새 시크릿 탭 → `:3000`.
2. Landing CTA → connect-wallet stage.
3. MetaMask 선택 → approve.
4. Sign in 클릭 → 서명 approve.
5. 자동 survey stage 진입.
6. SiteHeader 에 `0xabc...123` 표시.
7. Survey → tier → chat, SSE 응답 OK.
8. HQ 로그에서 `session.owner === wagmi.address`.

### S2. 서명 거부
1. S1.4 에서 Reject.
2. "Signature rejected. Try again." 표시 + Sign in 재활성화.
3. stage 는 connect-wallet 유지.

### S3. 토큰 만료
1. devtools 에서 `dispatch({ type: 'AUTH_RESET' })` 강제.
2. chat 메시지 전송 시도 → modal 열림.
3. 모달에서 Sign in → 모달 닫힘.

### S4. 계정 스위치
1. MetaMask 에서 다른 계정 전환.
2. wagmi `useAccount.address` 변화 감지 → `AUTH_RESET`.
3. SiteHeader 가 "Sign in" 으로.

### S5. dev-bypass 제거
1. HQ 재기동.
2. `curl -X POST :3003/api/v1/agent/sessions -H 'Authorization: Bearer dev' -d '{}'` → **401**.
3. 토큰 발급 후 → 200.

### S6. 네트워크 에러 / S7. CORS 확인.

### 자동 테스트
- `app-state.test.ts` — AUTH_* reducer 5건 (vitest 기존 셋업 있을 때만).

## 실패 / 에러 처리

| 시나리오 | 트리거 | 처리 | 메시지 |
|---|---|---|---|
| 서명 거부 | `UserRejectedRequestError` | AUTH_FAILED "rejected" | "Signature rejected. Click Sign in to try again." |
| popup 닫음 | 동일 throw | 동일 | 동일 |
| Challenge fetch 실패 | network throw | AUTH_FAILED "network" | "Could not reach DefiPilot server." |
| Challenge 만료 | verify 401 | AUTH_FAILED "expired_challenge" | "Sign-in expired. Try again." |
| Signature mismatch | verify 401 | AUTH_FAILED "sig_mismatch" | "Signature verification failed." |
| 토큰 만료 (`/agent/*` 401) | HqUnauthorizedError | AUTH_RESET + modal | "Session expired. Sign in again." |
| 계정 스위치 | useAccount 변화 | AUTH_RESET, stage→connect-wallet | "Account changed. Please sign in." |
| 체인 스위치 | chainId 변화 | **무시** | — |
| Disconnect 클릭 | useDisconnect | AUTH_RESET + GOTO landing | — |
| HQ 5xx | fetch !ok | AUTH_FAILED "server" | "Server error. Try again in a moment." |

전부 `console.warn('[siwe]', code, err)`.

## 롤아웃 / 롤백

### 배포 순서
1. **HQ 먼저**:
   - guard 의 dev-bypass 분기 삭제.
   - `.env.local` 에서 `AGENT_AUTH_DEV_BYPASS=1`, `AGENT_AUTH_DEV_WALLET` 제거.
   - `CORS_ORIGIN` 에 `http://localhost:3000` 추가.
   - `docker-compose.local.yml` 에 system prompt mount + 필요 env 추가.
   - `docker compose -f docker-compose.local.yml up -d --force-recreate api`.
   - 검증: S5.
2. **Web**:
   - `.env.local` 에서 `NEXT_PUBLIC_HQ_DEV_BEARER` 제거 (또는 무시).
   - `pnpm dev` 재기동.
   - 검증: S1.

순서 중요 — Web 먼저면 dev-bypass 가 살아서 의도된 경로 검증 못 함.

### 롤백
- HQ guard 분기 git revert + `.env.local` 에 `AGENT_AUTH_DEV_BYPASS=1` 복구 + 컨테이너 재기동.
- Web `hq-api.ts` git revert.

## 관측성

- 모든 auth 분기에 `console.info('[siwe]', code)`.
- 실패에 `console.warn('[siwe] failure', { code, err })`.
- hq-api 401 시 `console.warn('[hq-api] 401, clearing token')`.

향후 (OOS): Sentry 연동.

## 보안 / 권한

- **XSS**: token 을 in-memory 보관 (localStorage 대비 새 탭/세션 격리). 근본적 차이는 아님 — Next.js CSP 검토는 별도 ticket.
- **토큰 TTL**: 1시간 권장.
- **HQ secret**: `agent-auth.guard.ts` 의 token secret 이 기본값이면 강한 무작위 값으로 override 권장 (prod 전 필수).
- **Challenge replay**: 1회용 invalidate + TTL 5분 (HQ 책임, 가정).
- **Signature → Address 검증**: `recoverMessageAddress` 결과 == address (case-insensitive). EOA 만.
- **CORS**: wildcard 금지, `http://localhost:3000` 명시. credentials 미사용.

## 리스크 / 오픈 이슈

| ID | 항목 | 영향 | 대응 |
|---|---|---|---|
| R1 | HQ challenge 가 raw nonce 만 반환 | 사용자 신뢰 ↓ | HQ controller prefix 1줄 추가 (필요시 micro ticket) |
| R2 | HQ verify 가 signer 검증 누락 가능 | 중대 보안 | 코드 리뷰 + 누락 시 즉시 추가 |
| R3 | E2E mock connector 가 `useSignMessage` 미지원 | E2E 깨짐 | wagmi mock 의 `signMessage` 기본 사용, 안 되면 wrapper |
| R4 | walletConnect 모바일에서 sign popup deeplink 이슈 | 모바일 실패 | 데스크탑 위주 시연, 모바일은 known issue |
| R5 | 토큰 만료가 chat SSE 도중 발생 → 메시지 유실 | 사용자 입력 손실 | 만료 직전 5초 reject, 입력 복구는 chat 컴포넌트 처리 |
| R6 | Stage 순서 변경으로 deep-link 깨짐 | 없음 (단일 URL) | — |
| R7 | HQ guard 변경이 다른 통합 컨테이너 깨트림 | 저 | seabw-integration worktree 격리 |
| R8 | system prompt mount 안 잡힘 | chat 톤 다름 | `:ro` flag, `docker exec ... cat` 검증 |

오픈 이슈:
- O1: Disconnect 시 stage → landing 강제 (결정).
- O2: WalletBadge dropdown 은 sign out 만 (v1.3 에 chain switch).
- O3: ConnectWalletModal 인증 중 close 비활성화.

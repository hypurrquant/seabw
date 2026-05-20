# Wallet SIWE Auth - v1.2.1

## 문제 정의

### 현상
- `apps/web/src/lib/hq-api.ts:18` 가 `Authorization: Bearer dev` 를 **하드코딩**.
- HQ 컨테이너가 `AGENT_AUTH_DEV_BYPASS=1` 일 때만 동작 — 모든 요청이 `AGENT_AUTH_DEV_WALLET` (`0x...abc`) 한 주소로 임퍼소네이트됨.
- 그래서 사용자가 wagmi 로 다른 지갑(예: `0xMyMetamask`)을 connect 해도, HQ 측에서 본 `session.owner` 는 fake address 그대로.
- 또한 현재 stage 순서가 `landing → survey → tier-result → connect-wallet → chat` — 지갑 연결이 survey **이후** 로 밀려 있어 디지털 자산 advisor 흐름으로는 부자연스러움.
- 상단에 지갑 상태를 상시 표시하는 헤더 슬롯 없음 — SiteHeader 는 brand + 2개 nav 링크만.

### 원인
- v1.2.0 에서 chat SSE 흐름 구현을 우선했고, SIWE 클라이언트 흐름은 micro 티켓에 포함되지 않음 → `hq-api.ts` 가 plain bearer 로 단축됨.
- HQ apps/server 에는 `/agent/auth/challenge` + `/agent/auth/verify` (SIWE) 가 이미 구현돼 있음 (`apps/server/src/domains/agent/interface/agent-auth.controller.ts`) — **서버는 완비, 클라이언트가 호출만 안 함**.
- KOFIA 설문 응답(`Answers`, `TierResult`)이 PII (지갑 주소·잔고) 와 결합되지 않아도 의미를 갖는 데이터지만, 추후 LP 추천/tx 실행 흐름에선 owner 검증이 강제됨 → 지갑 인증을 사전에 고정해야 함.

### 영향
- **시연 신뢰도 ↓** — "wagmi 연결한 지갑 = HQ session owner" 라는 자명한 가정이 깨져 있음. 보여줄 수 없는 갭.
- **추후 tx signing loop 위험** — v1.3.0 wagmi sign 단계에서 "owner 가 다른 지갑인데 왜 내 지갑으로 서명하라고 하지?" 류 모순 발생.
- **dev backdoor 잔존** — 코드/컨테이너에 인증 우회 경로가 살아 있어 보안 표면이 커짐.
- **데모 UX 불일치** — 지갑 없는 사용자도 survey/report 까지 진행 가능 → 마지막에 wallet 막힘.

### 목표
- ConnectWallet + SIWE 가 **landing 직후, survey 이전** 단계가 됨. 진입 = "지갑 연결 + 서명 1회".
- `useApp().state` 에 인증된 wallet address + JWT 토큰 + 만료시각 보관. 모든 `/agent/*` fetch 가 이 토큰을 사용.
- 상단 SiteHeader 에 wallet 상태 (연결 여부 / 주소 truncate / disconnect 액션) 항상 노출.
- 지갑 연결 모달 — 현재 인라인 `ConnectWallet` 컴포넌트를 stage 진입 시점에 **모달** 로 띄울 수 있게 분리. 모달은 "지갑 선택 → connect → SIWE 서명 → 토큰 저장" 까지 한 흐름.
- HQ 컨테이너에서 `AGENT_AUTH_DEV_BYPASS` 완전 제거. seabw web 은 정식 SIWE 만으로 동작.
- 토큰 만료 / disconnect / address switch 시 자동 재인증 모달 트리거.

### 비목표 (Out of Scope)
- 토큰 자동 silent refresh (만료 N분 전 자동 verify) — 만료시 사용자에게 모달 노출로 충분.
- 멀티 디바이스 토큰 동기화.
- chain 별 인증 (현재 chain agnostic — `personal_sign` 만 씀).
- HQ apps/server 측 SIWE 구현 변경 (이미 구현됨, 그대로 사용).
- wallet 별 multi-account 지원 — 한 번에 active address 1개.
- tool 실행 / wagmi tx signing loop (v1.3.0 범위).

## 제약사항

### 시간
- 해커톤 막판 — 1-2 시간 내 구현 + 시연 가능해야.

### 기술
- wagmi v2 + viem 기반. Privy 도입 안 함 (HQ 메인이 Privy 쓰지만 seabw 는 wagmi 직접 유지).
- HQ `/agent/auth/verify` 는 `{ address, challenge, signature }` 를 받고 JWT 반환. challenge 는 서버가 캐싱하므로 동일 challenge 재제출 가능 (만료까지).
- 토큰은 client side 만 보관 (Next.js client component, SSR 안 함). localStorage 또는 zustand persist.
- 컨테이너 재기동 (`docker compose ... up -d --force-recreate api`) 1회 필요.

### 비즈니스
- 데모 환경 한정 — 운영 보안(httpOnly cookie 등) 미적용.

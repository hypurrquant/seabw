# 설계 - v1.3.1

## 접근법

### A. 부트 시점 설정 (HqBootProvider)
HQ apps/web의 `_providers/Providers.tsx` 패턴을 그대로 따른다:
- `hydrateTokenConfig()` (이미 v1.3.0 fix 에서 추가)
- **추가**: `hydratePoolConfig()` — Pool config store 채움. `ensurePools` 가 의존.

### B. 사용자별 prefetch hook 신규
- `apps/web/src/domains/positions/use-prefetch-user-data.ts`
- 입력: `ownerAddress`
- 동작:
  1. `ensurePools()` — pool list resolve (pool config store + pool store).
  2. `refreshAll(owner, [])` — 모든 지원 체인의 모든 known token 잔액 갱신.
  3. for each chain in SUPPORTED_CHAINS: `fetchPositionsByChain(owner, chainId, pools)` — LP 포지션.
  4. (선택) `refreshTokenPrices(knownTokens)` — 가격 갱신.
- 반환: `{ status: "idle" | "loading" | "ready" | "error", error?: string }`.

### C. /chat 페이지 흐름 변경
- 현재: ChatRoute mounts → SET_ANSWERS/SET_TIER → Chat 마운트 → useEffect 가 첫 메시지 발사.
- 변경:
  1. ChatRoute mounts → SET_ANSWERS/SET_TIER → **prefetch 시작** (status=loading)
  2. 화면: 좌측 TierResultView, 우측 "지갑 분석 중…" placeholder + spinner.
  3. status=ready 가 되면 Chat 마운트 → 첫 메시지 발사 (기존 흐름 그대로).
  4. status=error → 짧은 에러 메시지 + 재시도 버튼.

### D. AI tool 핸들러 — 변경 없음
- `get_enriched_balances`, `get_positions`, `get_pools` 등은 그대로 store에서 읽음.
- prefetch 가 store 를 채워뒀으므로 즉시 결과 반환.

## 버린 대안
- AI 첫 메시지에 미리 prefetched 데이터를 텍스트로 포함 → 토큰 낭비 + AI 가 stale 로 의심.
- chat.tsx 안에서 prefetch — Chat 컴포넌트 책임 비대화. 페이지 책임으로 분리.
- prefetch 를 HqBootProvider 안에서 → 사용자 인증 전엔 owner 없음. /chat 가 적절한 layer.

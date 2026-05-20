# Wallet SIWE Auth + AI Tool Loop - v1.2.1

> v1.2.1 은 두 단계로 구성: **(1차) Wallet SIWE Auth** — 완료 / **(2차) AI Tool Loop** — 현재 PRD.
> 둘 다 같은 v1.2.1 안에서 진행. 데모(2026-05-21)까지 합치 완성이 목표.

---

## 1차 — Wallet SIWE Auth (✅ 완료)

### 요약
`hq-api.ts` 의 하드코딩 `Bearer dev` 와 HQ 컨테이너의 `AGENT_AUTH_DEV_BYPASS=1` 의존을 걷어내고, wagmi 가 연결한 실제 지갑으로 HQ SIWE 흐름(challenge → sign → verify)을 호출해 JWT 토큰을 받아 모든 `/agent/*` 호출에 attach.
Stage 순서를 `landing → connect-wallet (+SIWE) → survey → tier-result → chat` 로 재배치, SiteHeader 에 wallet 상태 badge, ConnectWallet 풀페이지/모달 분리.

### 산출물 (변경 안 함)
- AppState 의 `auth: AuthState` 슬롯 + 5개 신규 액션.
- `domains/auth/{use-siwe-auth.ts, hq-client-provider.tsx}`.
- `domains/wallet/{connect-wallet-panel,connect-wallet-stage,connect-wallet-modal,wallet-modal-context}.tsx`.
- `components/wallet-badge.tsx`.
- HQ guard 의 dev-bypass 분기 삭제 + 컨테이너 `.env.local`/compose 정리.

### 검증 (완료)
- `pnpm typecheck` ✅ / `pnpm build` ✅.
- `curl -X POST :3003/api/v1/agent/sessions -H 'Authorization: Bearer dev'` → 401 확인.

---

## 2차 — AI Tool Loop (현재 PRD)

## 문제 정의

### 현상
- v1.2.0/v1.2.1 종료 시점 기준, seabw chat 은 HQ SSE 의 `tool_call` 이벤트에 대해 `chat.tsx:99-107` 에서 즉시 `TOOL_NOT_IMPLEMENTED` 응답을 보냄 → LLM 이 모든 실시간 데이터를 못 봄.
- 결과: AI 가 KOFIA 설문 결과 (tier/profile) 만으로 일반론적 LP 권유만 함. 실제 풀 데이터 / 가격 / 잔고 / 트랜잭션 calldata 어디에도 접근 못함.
- 데모 종단 시연 ("지갑 연결 → 설문 → AI 가 풀 3개 추천 → 카드 클릭 → 온체인 LP 진입") 불가능.

### 원인
- HQ frontend 자산(`packages/react/{agent,platform,auth,defi,...}` + `apps/web/src/domains/agent/tools/*`)이 seabw 로 전혀 끌어와지지 않음 (v1.1.0 backbone-only 결정 때문).
- BrowserToolRegistry / usePipelineStore / useAgentPipelineModal / 21개 tool 핸들러가 모두 HQ 측에만 존재.
- seabw 의 `domains/chat/chat.tsx` 가 자체 chat 흐름을 직접 짠 v1.2.0 결과 — HQ 의 `useAgentChat` 같은 상위 흐름 hook 도 안 씀.

### 영향
- 데모 데드라인 2026-05-21 — 현재 상태로는 절반짜리 데모 ("지갑 연결 + 설문 + AI 잡담").
- 향후 v1.3.0+ 의 portfolio 도메인, multi-step pipeline, advanced strategy 도 전부 막힘 (의존 기반이 없음).

### 목표 (P0 — 데모 생존선 / P1 — Stretch)

#### P0 — 내일 데모에 반드시 살아야 할 종단 path 1개
- 1개 chain (hyperEvm 또는 base) + 1개 mint 가능한 LP pool.
- LLM 이 chat 흐름에서 `propose_lp_positions` tool_call 발행 → **LP 카드 3장 렌더** (정확히 3개, LpCard zod 검증 통과).
- 사용자가 1개 카드 클릭 → 그 카드의 `recipe: RecipeAtom[]` 이 HQ `/pipeline/resolve` 로 전송 → preview 모달 노출 → `executeRecipe()` → wagmi 서명 popup → tx 전송 성공.
- 카드 렌더에 필요한 최소 query path: `get_wallet_status` + `get_pools` (또는 `get_pool_detail`) + `get_token_prices`.
- HQ `apps/web/src/domains/agent/tools/` 의 P0 path 에 필요한 tool 핸들러 (위 + `compose_pipeline`) 이 seabw 로 이식·등록되어 동작.
- `propose_lp_positions` 가 **HQ MCP server schema 에 신규 tool 로 추가** (`apps/server/tools/hypurrquant-mcp-server.ts`) 되어 LLM 이 호출 가능.
- DefiPilot system prompt 가 tier 별 LP 추천 시 반드시 `propose_lp_positions` 로 정확히 3장을 제시하도록 갱신.

#### P1 — 시간 남으면 (Stretch, 실패 시 OOS)
- HQ registry 의 나머지 16개 tool 도 seabw 에 등록 (총 22개: HQ 21개 + propose_lp_positions).
- `get_positions` / `get_enriched_balances` / `calculate_*` 6종 / `get_swap_quote` / `get_cached_balances` / `refresh_balances` / `get_native_balance` / `get_tokens` / `get_token_detail` / `get_tick_data`.
- 모든 tool 의 schema 등록은 끝났지만 P0 path 외에는 LLM 이 호출했을 때 동작 검증은 demo 시점에 생략 가능 (LLM 이 안 부르면 dead code).

### 비목표 (Out of Scope)
- 카드 재추천/추가 카드 요청 UI (한 번에 3장 고정).
- 다중 카드 동시 실행 (1번에 1 카드).
- 카드 비교 뷰 / 슬리피지·가스 세부 조정 UI.
- portfolio 모니터링 (v1.4.0+).
- HQ 의 21개 tool 자체 로직 수정 (있는 그대로 가져온다).
- `@hq/react/*` 패키지 자체 변경 (HQ 측 contract 그대로 사용).
- Account abstraction (`@zerodev/*`) — peerDep 으로 끌려와도 활성화 안 함.
- 다중 chain 동시 지원 — wagmi config 그대로, P0 는 1 chain 시연.
- 자동화된 E2E 테스트 — 데모 시연 위주.
- HQ 의 새 tool 이 추가될 때 자동 동기화.
- LP 카드의 metric (APR/TVL/IL) 정확성 — LLM 이 채운 값을 그대로 렌더 (검증 X).

## 제약사항

### 시간
- 데모 데드라인 **2026-05-21** (내일). Step 1~5B 전부 오늘 마감.

### 기술

#### A. HQ 패키지 재사용 가능성
- `@hq/react/agent` 만 가져오는 게 아니라 `useAgentChat`/`useAgentPipelineModal` 은 `@hq/react/platform`, `@hq/react/auth`, `@hq/react/defi/pipeline`, `@hq/core` 까지 transitive 의존. 모두 함께 끌어와야 함.
- `previewRecipe` / `executeRecipe` 가 `@hq/core` 의 `setHttpBaseUrl()` 로 base URL 받음 — Provider 초기화 시점에 `setHttpBaseUrl(NEXT_PUBLIC_HQ_BASE_URL)` 호출 안 하면 호출이 seabw dev server `:3000` 으로 가서 깨짐.
- HQ `@hq/react` peerDep: `react: ^18` vs seabw `react: 19` — peer 경고 무시 가능. 19-only API 사용 시 깨질 위험.
- HQ packages 다층 (`@hq/react/{agent,platform,auth,defi,token,...}`) — `pnpm-workspace.yaml` 에 HQ packages 디렉토리 통째로 link 가 가장 안전 (개별 add 시 transitive 누락).
- pnpm 의 `file:` 절대 경로 link 는 cross-monorepo node_modules 간 hoist 가 fragile — `link:` (deps 공유) 보다 `file:` (copy) 가 안전하나 매 변경마다 reinstall.

#### B. HQ tool 핸들러 이식
- `apps/web/src/domains/agent/tools/` 의 21개 핸들러는 packages 가 아닌 일반 app 코드 → workspace link 불가, **디렉토리째 seabw 로 복사** 필요.
- 핸들러 21개의 import 경로: `@hq/react/*`, `@hq/core/*`, `viem`, `@tanstack/react-query`, 로컬 `./` — 복사 후 `@/...` 가 아닌 `@hq/...` 는 그대로, 로컬 `./` 도 유지.
- `BrowserToolRegistry` 의 deps (`getPublicClient`, `getActiveAccount`, `balanceStore`, `getRelaySignDeps`, `getAuthToken`) 를 seabw 환경에서 wiring 필요.

#### C. HQ 서버 정합성
- `POST /api/v1/pipeline/resolve` 는 `AgentAuthGuard` 적용 — SIWE token 필요. seabw 의 `useAgentChat` provider 가 같은 토큰 source 를 쓰는지 보장.
- 컨테이너 `docker-compose.local.yml` 의 `environment.CORS_ORIGIN` 이 `.env.local` 의 같은 변수를 override 함. 현재 `environment` 줄에 **`http://localhost:3000` 빠져있음** — Step 5A 에서 compose 도 패치해야 브라우저에서 호출 가능.
- HQ MCP server (`apps/server/tools/hypurrquant-mcp-server.ts`) 에 `propose_lp_positions` schema 신규 등록 + 서버 컨테이너 재기동 필요.

#### D. 의존성 충돌 가능성
- viem / wagmi / @tanstack/react-query 의 메이저 버전이 HQ 와 seabw 사이에서 다르면 런타임 깨질 위험. 설치 후 lock 비교 + 충돌 시 seabw 측 버전을 HQ 측에 맞춰 올림.
- `@zerodev/*` 가 transitive 로 들어와도 사용 안 함 (tree-shake 의존, 번들 사이즈만 증가).

### 비즈니스
- 로컬 데모 한정 — 운영 보안/스케일 미적용.
- HQ worktree `feat/seabw-integration` 만 사용. HQ main/develop 영향 금지.

## 데모 생존선 (P0 명시)

```
[1] 사용자: 지갑 연결 + SIWE 서명 (1차에서 완료)
[2] 설문 10문항 → tier 진단
[3] chat 진입 → "내 tier 맞춰 LP 추천해" (또는 자동 첫 메시지)
[4] LLM → propose_lp_positions tool_call (3장 LpCard)
[5] seabw UI → 카드 3장 렌더
[6] 사용자: 1장 클릭
[7] seabw → POST /api/v1/pipeline/resolve { recipe: card.recipe }
[8] preview 모달 (HQ PipelinePreviewModal) → stage/calldata 표시
[9] 사용자 승인 → executeRecipe → wagmi signMessage / sendTransaction
[10] tx hash 받음 → 데모 종료
```

이 path 가 1개라도 살면 데모 통과. 그 외 22개 tool 의 LLM 자유 조합 시연은 stretch.

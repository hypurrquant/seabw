# DoD (Definition of Done) - v1.2.1 (2차: AI Tool Loop)

> 1차 SIWE Auth 의 DoD 는 PROGRESS.md 의 메모 + git 검증으로 닫힘 (v1.2.1 1차 완료 상태).
> 이 문서는 2차 AI Tool Loop 전용.

## P0 — 데모 생존선 (반드시 통과)

### 기능 완료 조건 (P0)

| # | 조건 | 검증 방법 |
|---|------|----------|
| F1 | seabw `pnpm-workspace.yaml` 가 HQ packages 디렉토리를 포함 | `grep "HypurrQuant_FE.*packages" pnpm-workspace.yaml` 1건 |
| F2 | `@hq/react` 와 `@hq/core` 가 `apps/web/node_modules/@hq/` 에 link 되어 있음 | `ls apps/web/node_modules/@hq/{react,core}/package.json` 둘 다 OK |
| F3 | `apps/web/src/domains/agent/tools/` 에 HQ 21개 핸들러 + `propose-lp-positions.ts` + `compose-pipeline/handler.ts` 존재, registry.register 21회 이상 호출 | `test -f apps/web/src/domains/agent/tools/propose-lp-positions.ts && test "$(rg -c "registry\\.register\\(" apps/web/src/domains/agent/tools/index.ts)" -ge 21 && rg "propose_lp_positions" apps/web/src/domains/agent` |
| F4 | `BrowserToolRegistry` + `createBrowserToolRegistry` import 가능 | `rg "createBrowserToolRegistry" apps/web/src/domains/agent/tools/index.ts` 1건 |
| F5 | `RegistryDeps` 5필드 (`getPublicClient/getActiveAccount/balanceStore/getRelaySignDeps/getAuthToken`) 가 `buildRegistryDeps()` 에서 모두 채워짐 | `for k in getPublicClient getActiveAccount balanceStore getRelaySignDeps getAuthToken; do rg "$k" apps/web/src/domains/agent/runtime/registry-deps.ts >/dev/null \|\| exit 1; done` |
| F6 | `HqBootProvider` 가 mount 시 `setHttpBaseUrl(NEXT_PUBLIC_HQ_ORIGIN)` + `initPlatformDeps(...)` 호출 | 코드 grep 2건 + `apps/web/.env.local.example` 에 `NEXT_PUBLIC_HQ_ORIGIN` 존재 |
| F7 | `AgentRuntimeProvider` 가 stable registry (mount 1회) + `initAgentDeps` (mount 1회) + `useAgentStore.auth` 동기화 | 코드 검토 — `useMemo(..., [])`, `useEffect(..., [])`, tokenRef 사용 |
| F8 | `propose_lp_positions` handler 가 zod 검증 + generatedAt 자동 채움 + `useLpProposalStore.push` 호출 | unit test 3건 (정상 / bad args / generatedAt 누락) 통과 |
| F9 | HQ MCP server `apps/server/tools/hypurrquant-mcp-server.ts` 에 `propose_lp_positions` schema 등록 | (a) HQ worktree `rg "propose_lp_positions" apps/server/tools/hypurrquant-mcp-server.ts` 1건 (b) 컨테이너 재기동 후 새 chat session 띄워 LLM 에 "list tools" 시켜 tool 인식 확인 (수동) |
| F10 | HQ `docker-compose.local.yml` 의 `environment.CORS_ORIGIN` 에 `http://localhost:3000` 포함 + 컨테이너 재기동 | `rg "localhost:3000" apps/server/docker-compose.local.yml` 1건 + 재기동 |
| F11 | seabw `domains/chat/chat.tsx` 가 자체 SSE 흐름 제거 + `useAgentChat` 사용 + sessionId 는 local state | `! rg "chatStream\\(\|submitToolResult\\(\|TOOL_NOT_IMPLEMENTED\|for await" apps/web/src/domains/chat/chat.tsx` (출력 0) + `rg "useAgentChat\|sendMessage\\(" apps/web/src/domains/chat/chat.tsx` 2건 이상 |
| F12 | chat 진입 시 `useHqClient().createSession(profile)` 로 sessionId 받고 `chat.sendMessage(tendencyPrompt, sid)` 호출 | `rg "createSession\\(\\{.*answers" apps/web/src/domains/chat` 1건 + `rg "sendMessage\\(" apps/web/src/domains/chat` 1건 |
| F13 | `useLpProposalStore` 가 `LpProposal` push/clear 가능 + Chat 컴포넌트가 store 구독해 `<LpCards/>` 렌더 | 시각 확인 (S0) + store unit |
| F14 | `selectLpCard(card, ctx)` 가 `guardRecipe` 실행 후 `previewRecipe(recipe, owner, null)` → `usePipelineStore.addPendingResolved(sid, base, resolved)` | `rg "guardRecipe\|previewRecipe\|addPendingResolved" apps/web/src/domains/agent/runtime/select-lp-card.ts` 3건 + unit (guard 통과 / 위반 시 throw) |
| F15 | Pipeline Ready 인라인 카드가 `pipelines[pipelineId].status` 별 분기 렌더 + Execute 버튼 클릭 시 `executePendingPipeline(...)` 호출 | 시각 확인 (S0) + `rg "executePendingPipeline" apps/web/src/domains/chat` 1건 |
| F16 | `executePendingPipeline` 가 `executeRecipe(recipe, owner, callbacks, null)` 호출 + 9개 callback 필드 (`onInit/onStepStart/onStepComplete/onStepSkipped/onStepError/onStepsSkipped/onStageSkipped/onComplete/onError`) 모두 포함 + txHash 수집 + `markExecuted` 호출 | `pnpm typecheck` (ExecutorCallbacks 타입 누락 시 빌드 실패) + 각 callback 키 `rg` 확인 9건 + unit (정상 path / onError path) |
| F17 | system prompt `docs/seabw-system-prompt.md` 에 "Tool 사용 규칙" 섹션 + `propose_lp_positions` 강제 카피 | `rg -c "propose_lp_positions" docs/seabw-system-prompt.md` >= 2 |
| F18 | dev-only "🔄 추천 재요청" 버튼이 chat header 에 노출 (`NODE_ENV !== "production"`) | `rg "NODE_ENV.*production\|추천 재요청" apps/web/src/domains/chat/chat.tsx` 1건 + 시각 확인 |
| F19 | **E2E S0 path**: 새 시크릿 탭 → connect-wallet → SIWE → survey → chat → LLM propose_lp_positions → 카드 3장 → 1개 클릭 → Pipeline Ready → Execute → wagmi 서명 → tx hash 표시 | 사용자 수동 시연 1회 성공 |
| F20 | 데모 환경 preflight — 데모 chain (hyperEvm 999 또는 base 8453) 에 mint 가능한 pool 1개 + 데모 지갑이 native gas + LP pair token 보유 | 수동: (a) `get_pools` 후보 1개 확인, (b) `cast balance <addr>` 또는 지갑 UI 로 native > gas 비용, (c) pair token 잔고 > suggestedAmountUsd 환산 |

### 비기능 완료 조건 (P0)

| # | 조건 | 검증 방법 |
|---|------|----------|
| N1 | seabw `pnpm typecheck` (apps/web) 통과 | `pnpm typecheck`, exit 0 |
| N2 | seabw `pnpm build` (apps/web) 통과 | `pnpm build`, exit 0 |
| N3 | HQ worktree `pnpm --filter hypurrquant-fe-server build` 통과 | 명령 실행 |
| N4 | seabw 신규 npm dep 가 `@hq/react`, `@hq/core`, `zustand` 3개로 제한 (그 외 추가 0) | `git diff apps/web/package.json` |
| N5 | HQ 컨테이너 재빌드 후 `/api/v1/agent/auth/challenge` 정상 응답 | `curl -fsS "http://localhost:3003/api/v1/agent/auth/challenge?address=0x1234567890123456789012345678901234567890"` exit 0 + JSON `data.challenge` 문자열 포함 |
| N6 | LpProposal zod 검증 unit 5건 + guardRecipe unit 5건 통과 | `pnpm test` exit 0 (관련 케이스만) |
| N7 | 1차 SIWE Auth 흐름 회귀 없음 — connect-wallet → SIWE → token 발급 → /agent/sessions 200 | curl + 시각 확인 |
| N8 | `@hq/react` peerDep 충돌 없음 (react 19 환경에서 `pnpm install` 경고만, 에러 0) | install log |
| N9 | Provider 트리에서 `initPlatformDeps` / `initAgentDeps` 중복 호출 throw 없음 | 브라우저 콘솔 에러 0 |
| N10 | base URL 더블 prefix (`/api/v1/api/v1`) 호출 없음 | devtools Network 탭 — 모든 `/agent/*`, `/pipeline/*` URL 단일 prefix |

### 엣지케이스 (P0 안전망)

| # | 시나리오 | 기대 동작 | 검증 방법 |
|---|----------|-----------|----------|
| E1 | LLM 이 propose_lp_positions 형식 위반 (2장만 보냄) | tool_result error "LpProposal validation failed: cards: ..." 로 회신 → LLM 재시도 | 수동 (시스템 프롬프트 약화 후) |
| E2 | LLM 이 propose 안 부르고 텍스트만 답함 | "🔄 추천 재요청" 버튼 클릭 → tendency prompt 재발송 → 다시 시도 | S1 |
| E3 | guardRecipe atom 위반 (LLM 이 borrow atom 인코딩) | selectLpCard throw → chat 에 "recipe atom 'borrow' not allowed" 표시 | unit + 수동 |
| E4 | guardRecipe amount cap 위반 ($2000) | selectLpCard throw → chat 에 "exceeds $1000 cap" 표시 | unit |
| E5 | wagmi 서명 거부 | `onError(error)` → markFailed + 카드에 에러 메시지 | S2 |
| E6 | `/pipeline/resolve` 5xx | markResolveFailed → 카드에 에러 + retry 옵션 | S3 |
| E7 | SIWE 토큰 만료 (/pipeline/resolve 401) | HqUnauthorizedError → AUTH_RESET + walletModal.open() | S5 |
| E8 | initPlatformDeps 가 mount 전 fetch 가 트리거됨 | HqBootProvider 가 ProviderTree 최상위 가까이 — mount 순서 보장 | 시각 확인 (콘솔 에러 없음) |
| E9 | 계정 스위치 후 token 변경 | tokenRef.current 가 자동 갱신 (mount 1회 registry 그대로) | 수동 (지갑 계정 전환) |
| E10 | 페이지 새로고침 후 in-memory state 휘발 | 자동 connect-wallet stage 로 리라우트 (1차 패턴) | 수동 |
| E11 | LLM 이 P0 외 tool 호출 (예: `get_swap_quote`) | 등록되어 있어 실행 시도 — 핸들러 동작은 P1 — 실패 시 tool_result error 회신, chat 살아있음 | 수동 |
| E12 | chat 진입 시 sessionId 가 race 로 두 번 생성 시도 | useEffect deps + sessionId state 조건으로 1회만 | 코드 검토 |

---

## P1 — Stretch (실패해도 데모 통과)

| # | 조건 | 검증 |
|---|------|------|
| P1-1 | 21개 HQ tool 핸들러 import error 없이 빌드 통과 | `pnpm build` 에서 missing import 0 |
| P1-2 | LLM 이 `get_positions` 호출 시 동작 — 빈 결과여도 throw 안 함 | 수동 |
| P1-3 | LLM 이 `calculate_optimal_range` 호출 시 동작 | 수동 |
| P1-4 | tickProvider wiring — mint preview 시 정확한 tick 반영 | OOS in P0 |

---

## 검증 명령 모음

```bash
# seabw 측
cd /Users/mousebook/Documents/hypurrquant/seabw
pnpm install   # workspace cross-directory link 검증 (10분 이내)
pnpm typecheck
pnpm build
pnpm test   # vitest (LpProposalSchema + guardRecipe unit)

# HQ 측
cd /Users/mousebook/Documents/side-project/HypurrQuant_FE/worktrees/seabw-integration/apps/server
docker compose -f docker-compose.local.yml up -d --build api
# MCP schema 등록 확인 (코드 + 수동)
rg "propose_lp_positions" apps/server/tools/hypurrquant-mcp-server.ts
# (수동) 컨테이너 재기동 후 새 chat session 띄워 LLM 에 "list available tools" 시켜 propose_lp_positions 인식 확인

curl -fsS "http://localhost:3003/api/v1/agent/auth/challenge?address=0x1234567890123456789012345678901234567890" | jq .data.challenge
# CORS 확인
curl -i -H "Origin: http://localhost:3000" http://localhost:3003/api/v1/pools 2>&1 | grep -i "access-control-allow-origin"
```

수동 시연:
1. `pnpm dev` (seabw) — `:3000`
2. 새 시크릿 탭 → `:3000` 진입
3. CTA → connect-wallet → MetaMask connect → Sign in (SIWE)
4. survey 10문항 → tier-result → "AI와 대화 시작"
5. chat 진입 후 자동 첫 메시지 발송 확인
6. LLM 이 get_wallet_status / get_pools / get_token_prices / propose_lp_positions 흐름 따라가는지 확인
7. 카드 3장 렌더 확인 → 1개 클릭
8. Pipeline Ready 카드 → Execute → wagmi 서명 popup
9. tx hash 표시 → 데모 완료

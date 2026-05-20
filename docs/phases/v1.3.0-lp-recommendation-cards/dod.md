# DoD (Definition of Done) - v1.3.0

## 기능 완료 조건

### Tool / Handler

| # | 조건 | 검증 방법 |
|---|------|----------|
| F1 | `apps/web/src/domains/agent/tools/propose-lp-positions/schema.ts` 가 `LpCardArgsSchema`, `LpProposalArgsSchema`, `TokenRefSchema` zod 정의 + `LpCard`, `LpProposal` 타입 export | `grep -E "LpCardArgsSchema\|LpProposalArgsSchema\|TokenRefSchema" apps/web/src/domains/agent/tools/propose-lp-positions/schema.ts` 3 hits |
| F2 | `LpProposalArgsSchema.proposal.cards` 가 정확히 3개 튜플 (`z.tuple([..., ..., ...])`) | `grep "z.tuple" apps/web/src/domains/agent/tools/propose-lp-positions/schema.ts` 1+ hit |
| F3 | `propose-lp-positions/handler.ts` 가 `createProposeLpPositionsHandler({ lpProposalStore })` factory 노출 | `grep "export function createProposeLpPositionsHandler" ...` 1 hit |
| F4 | handler 가 args 검증 → 실패 시 `{status:'error', code:'INVALID_ARGS'}` 반환, 성공 시 `lpProposalStore.addProposal(sessionId, ...)` 호출 + `{status:'success', data:{cardIds}}` 반환 | unit test 통과 (S-AUTO-1) |
| F5 | handler 가 카드별 `id = crypto.randomUUID()` 부여하여 store 에 보관 | unit test (S-AUTO-2) |
| F6 | `apps/web/src/domains/agent/tools/index.ts` 가 `propose_lp_positions` 를 `BrowserToolRegistry.register()` 로 등록 | `grep "propose_lp_positions" apps/web/src/domains/agent/tools/index.ts` 1 hit |

### Store

| # | 조건 | 검증 방법 |
|---|------|----------|
| F7 | `apps/web/src/domains/agent/stores/use-lp-proposal-store.ts` 가 zustand `useLpProposalStore` export | `grep "export const useLpProposalStore" ...` 1 hit |
| F8 | Store actions: `addProposal(sessionId, proposal)`, `clearProposal(sessionId)`, `selectProposal(sessionId, rank)` 3종 | unit test 통과 (S-AUTO-3) |
| F9 | `addProposal` 이 같은 sessionId 의 기존 proposal 을 무조건 교체 | unit test (S-AUTO-4) |
| F10 | `selectProposal` 이 rank ∈ {1,2,3} 의 `LpCard` 를 반환, 그 외 `null` | unit test (S-AUTO-5) |

### Modal / UI

| # | 조건 | 검증 방법 |
|---|------|----------|
| F11 | `apps/web/src/domains/chat/lp-proposal-modal.tsx` 가 `<LpProposalModalHost/>` + `<LpCard/>` 컴포넌트 export | `grep -E "export function LpProposalModalHost\|export function LpCard" ...` 2 hits |
| F12 | `<LpProposalModalHost/>` 가 `useLpProposalStore` 구독 — proposal 존재 시 모달 표시, 없으면 미표시 | 수동 (S1) |
| F13 | `apps/web/src/components/providers.tsx` 의 트리에 `<LpProposalModalHost/>` mount | `grep "LpProposalModalHost" apps/web/src/components/providers.tsx` 1 hit |
| F14 | 모달이 화면 중앙 (정확히 viewport 중앙 고정 위치) 에 표시 | 수동 — devtools 로 position fixed + center 확인 |
| F15 | 카드 3장이 rank 순서 (1→2→3) 로 렌더, rank 1 카드가 시각적으로 강조 (border/배지 등) | 수동 (S1) |
| F16 | 각 카드에 protocol, pair, fee tier, APR, TVL, IL risk, pros/cons, tierAlignment 배지가 표시 | 수동 — 데모 데이터로 모든 필드 노출 확인 |

### 연계 (chat + selection)

| # | 조건 | 검증 방법 |
|---|------|----------|
| F17 | 카드 클릭 시 `useAgentChat.sendMessage('[Selection] I choose option <rank>.')` 호출 + `clearProposal(sessionId)` 호출 + 모달 닫힘 | 수동 (S1) + console log |
| F18 | `chat.tsx` 의 `onSend()` 가 메시지 전송 직전 `clearProposal(sessionId)` 호출 | `grep "clearProposal" apps/web/src/domains/chat/chat.tsx` 1+ hit + 수동 (S2) |
| F19 | 새 사용자 메시지 전송 시 모달 즉시 사라짐 | 수동 (S2) |

### HQ MCP

| # | 조건 | 검증 방법 |
|---|------|----------|
| F20 | HQ worktree `apps/server/tools/hypurrquant-mcp-server.ts` 에 `propose_lp_positions` tool 등록 (`server.tool('propose_lp_positions', ...)` ) | `grep "propose_lp_positions" /Users/mousebook/Documents/side-project/HypurrQuant_FE/worktrees/seabw-integration/apps/server/tools/hypurrquant-mcp-server.ts` 1+ hit |
| F21 | MCP schema 의 cards 가 정확히 3개 (zod tuple) — seabw zod 와 필드 명/타입 일치 | 수동 grep 비교 (seabw schema.ts ↔ MCP server) |
| F22 | worktree commit prefix `[seabw]` 로 변경사항 commit | `git -C <worktree> log --oneline -3` |

### System prompt

| # | 조건 | 검증 방법 |
|---|------|----------|
| F23 | `docs/seabw-system-prompt.md` 에 "LP 추천 규약" 절 신규 추가 — "반드시 `propose_lp_positions` 사용 / 정확히 3장 / rank 1=최고 추천 / `[Selection] I choose option N.` 수신 시 N번째 카드 recipe 로 `compose_pipeline` 호출 / tier 한도 가드" | `grep -i "propose_lp_positions" docs/seabw-system-prompt.md` 1+ hit |

## 비기능 완료 조건

| # | 조건 | 검증 방법 |
|---|------|----------|
| N1 | `pnpm typecheck` (apps/web) 통과 | exit 0 |
| N2 | `pnpm build` (apps/web) 통과 | exit 0 |
| N3 | `pnpm lint` (apps/web) 통과 | exit 0 |
| N4 | `pnpm test` (apps/web) — 신규 unit test 5건 통과 (S-AUTO-1~5) | exit 0 |
| N5 | HQ worktree `pnpm --filter hypurrquant-fe-server build` 통과 | exit 0 |
| N6 | 신규 npm 의존성 추가 0개 (zustand 등 v1.2.1 2차에서 이미 들어옴) | `apps/web/package.json` diff |
| N7 | 모든 `console.info('[lp-proposal]', ...)` 로그가 handler/store/모달 분기에 박힘 (관측성) | grep 5+ hits |
| N8 | CLAUDE.md 의 "현재 페이즈"가 v1.3.0 으로 갱신됨 + v1.2.1 2차는 "이전 페이즈"로 이동 | head CLAUDE.md |
| N9 | PROGRESS.md 의 모든 Step 이 ✅ 완료 표시 | 파일 확인 |

## 엣지케이스

| # | 시나리오 | 기대 동작 | 검증 방법 |
|---|---------|----------|----------|
| E1 | AI 가 cards 를 4 개 또는 2 개로 보냄 | handler 가 `{status:'error', code:'INVALID_ARGS'}` 반환, 모달 안 뜸. LLM 은 후속 텍스트 응답으로 fallback | 수동 (S3) — devtools 로 args 조작 또는 system prompt 무력화 |
| E2 | AI 가 `recipe` 필드 누락된 카드 보냄 | handler 가 INVALID_ARGS 반환 | 수동 (S3 변형) |
| E3 | 카드 모달 표시 중 사용자가 새 메시지 입력 | 모달 즉시 사라짐, 새 메시지 정상 전송 | 수동 (S2) |
| E4 | 같은 세션에서 AI 가 propose_lp_positions 를 두 번 호출 | 두번째 호출이 첫번째 카드 교체 | 수동 — system prompt 우회 또는 fast 재호출 시연 |
| E5 | 카드 클릭 → sendMessage 가 네트워크 실패 | 토스트 + 모달 재오픈 (clearProposal 롤백) — 사용자가 다시 클릭 가능 | 수동 — devtools 로 fetch 차단 |
| E6 | LLM 이 "I choose option N" 수신 후 compose_pipeline 안 부르고 텍스트만 답함 | UI 변화 없음 (text 만 표시). prompt 보강이 1차 대응 | 수동 (S5) — 시연 후 prompt 개선 |
| E7 | 모달 표시 중 사용자가 stage 를 떠남 (예: disconnect) | `AUTH_RESET` 시 store clear 도 같이 호출되어 모달 사라짐 | 수동 — WalletBadge 의 disconnect 클릭 |
| E8 | PipelinePreviewModal 과 LpProposalModal 이 동시 표시될 수 있는 race | LP 모달은 카드 클릭 시점에 닫히므로 이론상 동시 노출 X. 동시 발생 시 z-index 같은 레벨, LP 가 위 | 수동 — 시연 중 우연 발생 모니터링 |
| E9 | system prompt 가 마운트 안 됨 (HQ env 누락) | AI 가 propose_lp_positions 안 부름 — UI 변화 없음, 데모 fail | HQ 컨테이너 `cat /seabw/seabw-system-prompt.md` 검증 (v1.2.1 1차 F12 와 동일) |
| E10 | 카드의 `recipe` 가 빈 배열 | compose_pipeline 단계에서 INVALID — 본 phase 외 책임. LP 모달은 정상 표시 | 수동 — args 조작 |
| E11 | 모달 표시 중 페이지 새로고침 | store 휘발 (zustand in-memory) → 모달 안 뜸. AI 가 재추천하지 않으면 사라진 상태 유지 | 수동 |
| E12 | sessionId 가 store 에 없는 상태에서 selectProposal 호출 | `null` 반환 — 모달은 store 에 proposal 없으면 표시 안 되므로 호출 자체 발생 X | unit test (S-AUTO-5) |

# 작업 티켓 - v1.2.1 (2차 AI Tool Loop)

> 1차 SIWE Auth 의 티켓은 `../step-01~06.md` (모두 ✅ 완료). 이 폴더는 2차 티켓.

## 전체 현황

| # | Step | 난이도 | 롤백 | Scope | FP/FN | 개발 | 완료일 |
|---|------|--------|------|-------|-------|------|--------|
| 11 | HQ worktree — MCP schema + docker-compose CORS 패치 + 컨테이너 재기동 | 🟠 | ✅ | HQ worktree apps/server | ✅ | ⏳ | - |
| 12 | seabw workspace cross-directory link + `@hq/react`/`@hq/core` 의존 추가 + pnpm install | 🟠 | ✅ | seabw root (pnpm-workspace.yaml, package.json) | ✅ | ⏳ | - |
| 13 | HQ tool 핸들러 21개 + ServerProxyProvider seabw 복사 + buildRegistryDeps 작성 | 🟠 | ✅ | seabw apps/web/src/domains/agent | ✅ | ⏳ | - |
| 14 | propose_lp_positions handler + LpProposalSchema + useLpProposalStore + zod unit | 🟡 | ✅ | seabw apps/web/src/domains/agent | ✅ | ⏳ | - |
| 15 | HqBootProvider + AgentRuntimeProvider + Provider 트리 wiring + .env.local 갱신 | 🟠 | ✅ | seabw apps/web/src/components/providers.tsx + domains/agent | ✅ | ⏳ | - |
| 16 | chat.tsx 재작성 (useAgentChat + LpCards + Pipeline Ready + selectLpCard + guardRecipe + executePendingPipeline + dev-only 버튼) | 🔴 | ✅ | seabw apps/web/src/domains/chat | ✅ | ⏳ | - |
| 17 | system prompt 갱신 + E2E preflight + 빌드/typecheck 검증 | 🟢 | ✅ | seabw docs/seabw-system-prompt.md + 전체 검증 | ✅ | ⏳ | - |

## 의존성

```
11 (HQ container) ─────────────────────────────► 17 (E2E)
12 (workspace install)
 └──► 13 (tool 이식)
       └──► 14 (propose handler + store)
             └──► 15 (provider wiring — propose registry 등록 포함)
                   └──► 16 (chat 재작성 + cards + pipeline + runtime)
                         └──► 17 (E2E)
```

- 11 과 (12→13→14→15→16) chain 은 병렬 가능.
- 17 은 11 + 16 둘 다 끝난 후.
- 15 가 14 의 `createProposeLpPositionsHandler` 와 `useLpProposalStore` 를 import 해서 registry 에 등록하므로 `13 → 14 → 15` 순서 강제.

## 커버리지 매트릭스

### DoD F-항목 → 티켓
| F | 티켓 |
|---|------|
| F1 workspace yaml | 12 |
| F2 @hq/* link | 12 |
| F3 tools/ + propose | 13 + 14 |
| F4 createBrowserToolRegistry import | 13 |
| F5 RegistryDeps 5필드 | 13 |
| F6 HqBootProvider setHttpBaseUrl + initPlatformDeps | 15 |
| F7 AgentRuntimeProvider stable registry + initAgentDeps + store sync | 15 |
| F8 proposeHandler zod + push | 14 |
| F9 MCP schema | 11 |
| F10 docker-compose CORS | 11 |
| F11 chat.tsx 자체 SSE 제거 | 16 |
| F12 createSession(profile) + sendMessage | 16 |
| F13 useLpProposalStore + LpCards | 14 + 16 |
| F14 selectLpCard guardRecipe + previewRecipe + addPendingResolved | 16 |
| F15 Pipeline Ready 카드 + Execute | 16 |
| F16 executePendingPipeline 9-callback | 16 |
| F17 system prompt 갱신 | 17 |
| F18 dev-only 버튼 | 16 |
| F19 E2E S0 | 17 |
| F20 preflight | 17 |

### DoD N-항목 → 티켓
| N | 티켓 |
|---|------|
| N1 typecheck | 모든 티켓 (각 PR 마다) + 17 |
| N2 build | 17 |
| N3 HQ build | 11 |
| N4 deps 3개만 | 12 |
| N5 challenge 200 | 17 (preflight) |
| N6 unit | 14 + 16 |
| N7 1차 SIWE 회귀 | 17 |
| N8 peerDep | 12 |
| N9 init throw 0 | 15 |
| N10 더블 prefix 0 | 17 (Network 탭) |

### DoD E-엣지 → 티켓
| E | 티켓 |
|---|------|
| E1 zod fail | 14 |
| E2 fallback | 16 (dev 버튼) |
| E3/E4 guard 위반 | 16 |
| E5 wagmi reject | 16 |
| E6/E7 resolve 401/5xx | 16 |
| E8 init 순서 | 15 |
| E9 account switch | 15 (tokenRef) |
| E10 reload | 1차 SIWE 그대로 |
| E11 P1 tool 호출 | 13 (등록) |
| E12 race | 16 |

### Design 결정 → 티켓
| 결정 | 티켓 |
|---|------|
| A3 workspace cross-dir | 12 |
| B2 useAgentChat | 16 |
| C1 LLM args 직접 | 14 |
| D1 RecipeAtom[] | 14 + 16 |
| E1/E2 fallback | 16 + 17 |
| Provider 트리 분리 (HqBoot/AgentRuntime) | 15 |
| B안 — seabw local executor | 16 |
| stable registry + tokenRef | 15 |
| MCP schema 추가 + codex 인식 | 11 |

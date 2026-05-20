# Phase 진행 상황 - v1.2.1

## Codex Session ID
`/Users/mousebook/Documents/hypurrquant/seabw/docs/phases/v1.2.1-wallet-siwe-auth`

## 현재 단계: Step 5A 완료 (scope 확장 — AI Tool Loop 추가), Step 5B 최종 게이트 대기

## Scope 변경 이력
- **2026-05-20 (1차)**: Wallet SIWE Auth 완료 (✅ 5 step 전부).
- **2026-05-20 (2차)**: 데모(2026-05-21) 요구로 **AI Tool Loop 추가** — HQ packages/react/{agent,platform,auth,defi,...} 재사용 + apps/web/src/domains/agent/tools 21개 핸들러 이식 + `propose_lp_positions` 신규 (총 22개), LP 카드 3장 UI, compose_pipeline → wagmi 서명까지. 같은 v1.2.1 안에서 scope 확장.

## Phase Steps (1차 SIWE Auth)

| Step | 설명 | 상태 | Codex 리뷰 | 완료일 |
|------|------|------|-----------|--------|
| 1 | PRD (SIWE) | ✅ 완료 | — (당시 미적용) | 2026-05-20 |
| 2 | Design (SIWE) | ✅ 완료 | — | 2026-05-20 |
| 3 | DoD (SIWE) | ✅ 완료 | — | 2026-05-20 |
| 4 | Tickets (SIWE step-01~06) | ✅ 완료 | — | 2026-05-20 |
| 5 | 개발 (SIWE) | ✅ 완료 | — | 2026-05-20 |

## Phase Steps (2차 — AI Tool Loop)

| Step | 설명 | 상태 | Codex 리뷰 | 완료일 |
|------|------|------|-----------|--------|
| 1 | PRD (Tool Loop) | ✅ 완료 | ✅ 통과 (재리뷰) | 2026-05-20 |
| 2 | Design (Tool Loop) | ✅ 완료 | ✅ 통과 (4차 재리뷰) | 2026-05-20 |
| 3 | DoD (Tool Loop) | ✅ 완료 | ✅ 통과 | 2026-05-20 |
| 4 | Tickets (Tool Loop) | ✅ 완료 | ✅ 통과 | 2026-05-20 |
| 5A | 개발 (Codex 위임) | ✅ 완료 | 구현 완료 | 2026-05-20 |
| 5B | 최종 게이트 (Codex) | ⏳ 대기 | ⏳ | - |

## 메모
- 2026-05-20: 1차 SIWE Auth 완료. PROGRESS·CLAUDE.md ✅ 완료 마킹됨.
- 2026-05-20: 2차 scope 확장 시작. team-phase-workflow 로 Codex 게이트 5건 + Codex 구현 위임 모델 적용.
- 데모 데드라인: **2026-05-21**.
- 변경 결정: 옵션 A (HQ tool 전부 통합) — registry 실제 등록 수 **21개** 확인 (Codex Gate 1). + `propose_lp_positions` 신규 = 총 22개.
- HQ 통합 전략: `@hq/react/{agent,platform,auth,defi,...}` 는 packages 라 pnpm `file:` link 시도, `apps/web/src/domains/agent/tools/*` (21개 핸들러) 는 HQ apps/web 안이라 seabw 로 복사·이식 필요.
- **P0 / P1 분리**: P0 = "LP 카드 1개 클릭 → 온체인 sign 까지" 종단 1 path. P1 = 나머지 tool 호출 검증. README §데모 생존선.
- Codex Gate 1~4: 모두 통과.
- Step 11~17 완료 요약: HQ MCP `propose_lp_positions` schema + CORS :3000, seabw workspace link, HQ tools 21개 이식, `propose_lp_positions` browser handler/store/tests, HqBootProvider/AgentRuntimeProvider, LP card UI, Pipeline Ready/execute runtime, system prompt tool rules 추가.
- 자동 검증: `pnpm typecheck`, `pnpm build`, `pnpm test`, HQ challenge/CORS preflight, DoD F 자동 grep 세트 실행.

## 부팅 / 시연 절차 (S0)

```bash
# seabw web (:3000)
pnpm install
cp apps/web/.env.local.example apps/web/.env.local
pnpm dev

# HQ apps/server (:3003) — 이미 hq-api 컨테이너가 떠 있어야 함
cd /Users/mousebook/Documents/side-project/HypurrQuant_FE/worktrees/seabw-integration/apps/server
docker compose -f docker-compose.local.yml up -d api
```

S0 path:
1. 새 브라우저 탭에서 `http://localhost:3000` 접속.
2. 지갑 연결 → SIWE 서명.
3. 설문 완료 → tier result 확인.
4. AI chat 진입 → 첫 tendency prompt 자동 발송.
5. LLM tool loop: `get_wallet_status` → pool/price 조회 → `propose_lp_positions`.
6. LP 카드 3장 표시.
7. 카드 1개 선택 → Pipeline Ready 카드 표시.
8. Execute → wagmi 서명 → tx hash 표시.

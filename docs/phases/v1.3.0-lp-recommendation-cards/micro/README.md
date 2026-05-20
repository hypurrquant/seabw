# 작업 티켓 - v1.3.0

## 전체 현황

| # | Step | 난이도 | 롤백 | Scope | FP/FN | 개발 | 완료일 |
|---|------|--------|------|-------|-------|------|--------|
| 01 | LpCard / LpProposal zod 스키마 + 타입 | 🟡 | ✅ | ✅ | ✅ | ⏳ | - |
| 02 | useLpProposalStore (zustand) + unit test | 🟡 | ✅ | ✅ | ✅ | ⏳ | - |
| 03 | propose_lp_positions handler + registry 등록 + unit test | 🟠 | ✅ | ✅ | ✅ | ⏳ | - |
| 04 | LpProposalModalHost + LpCard UI + providers mount | 🟠 | ✅ | ✅ | ✅ | ⏳ | - |
| 05 | chat.tsx 연계 (clear + selection sendMessage) | 🟡 | ✅ | ✅ | ✅ | ⏳ | - |
| 06 | HQ MCP tool + system prompt + 통합 smoke | 🟠 | ✅ | ✅ | ✅ | ⏳ | - |

## 의존성

```
01 (schema) ─────────┐
                     ├──► 03 (handler) ─────┐
02 (store) ──────────┤                      │
        │            │                      ├──► 05 (chat wiring) ──► 06 (HQ MCP + smoke)
        └──► 04 (modal) ──────────────────┘
```

- 01, 02 는 병렬 가능.
- 03 은 01+02 둘 다 필요.
- 04 는 02 만 있으면 시작 가능 (스토리북 mock 으로 사전 시각화 가능).
- 05 는 04 + 02 필요.
- 06 은 마지막 (web side 모두 끝난 후 HQ 연동 + 시연).

## Step 상세

- [Step 01: schema + types](step-01-schema.md)
- [Step 02: store](step-02-store.md)
- [Step 03: handler + registry](step-03-handler.md)
- [Step 04: modal UI](step-04-modal.md)
- [Step 05: chat wiring](step-05-chat-wiring.md)
- [Step 06: HQ MCP + smoke](step-06-hq-and-smoke.md)

## 커버리지 매트릭스

### PRD 목표 → 티켓

| PRD 목표 (README.md) | 관련 티켓 | 커버 |
|----------------------|----------|------|
| `propose_lp_positions` 신규 tool (handler + MCP schema) | 03, 06 | ✅ |
| `LpCard` / `LpProposal` zod 스키마 확정 | 01 | ✅ |
| `<LpProposalModal/>` UI — 화면 중앙 모달 | 04 | ✅ |
| 카드 클릭 → "I choose option N" 재전송 (AI 매개) | 05 | ✅ |
| 카드 잔존 정책 — 새 메시지 시 clear | 05 | ✅ |
| DefiPilot system prompt 갱신 | 06 | ✅ |

### DoD → 티켓

| DoD 항목 | 티켓 |
|----------|------|
| F1 schema.ts 존재 + 타입 export | 01 |
| F2 cards z.tuple([..., ..., ...]) | 01 |
| F3 createProposeLpPositionsHandler factory | 03 |
| F4 args 검증 / store push / 회신 | 03 |
| F5 cardId UUID 자동 부여 | 03 |
| F6 tools/index.ts registry 등록 | 03 |
| F7 useLpProposalStore export | 02 |
| F8 addProposal/clearProposal/selectProposal 3종 | 02 |
| F9 addProposal 기존 교체 | 02 |
| F10 selectProposal rank ∈ {1,2,3} | 02 |
| F11 LpProposalModalHost + LpCard export | 04 |
| F12 host 가 store 구독 | 04 |
| F13 providers.tsx mount | 04 |
| F14 화면 중앙 fixed | 04 |
| F15 rank 순서 + rank 1 강조 | 04 |
| F16 모든 필드 표시 | 04 |
| F17 카드 클릭 → sendMessage + clear + 닫힘 | 05 |
| F18 chat.tsx onSend 가 clearProposal 호출 | 05 |
| F19 새 메시지 시 모달 사라짐 | 05 |
| F20 HQ MCP propose_lp_positions 등록 | 06 |
| F21 MCP cards z.tuple 3개 | 06 |
| F22 worktree commit `[seabw]` prefix | 06 |
| F23 system prompt 규약 절 + few-shot | 06 |
| N1~N5 typecheck/build/lint/test | 06 (전 step 진행 중 모니터링) |
| N6 의존성 추가 0 | 전 step (자기 검증) |
| N7 `[lp-proposal]` 로그 | 03 (handler) + 04 (modal) |
| N8 CLAUDE.md 현재 페이즈 갱신 | 06 |
| N9 PROGRESS.md ✅ | 06 |
| E1~E12 엣지 | 06 (수동 시연 위주) |

### 설계 결정 → 티켓

| 설계 결정 (design.md) | 티켓 |
|----------------------|------|
| A2 sendMessage("I choose option N") 재전송 | 05 |
| B2 store-watch 패턴 (handler → store → 모달 자동 오픈) | 02 + 03 + 04 |
| C2 seabw zod SSOT + HQ MCP 수동 미러 | 01 + 06 |
| handler factory `createProposeLpPositionsHandler({lpProposalStore})` | 03 |
| `crypto.randomUUID()` 카드 ID | 03 |
| `[Selection]` prefix 메시지 | 05 |
| LpCardArgsSchema.recipe `z.array(z.unknown())` (검증 skip) | 01 |
| modal mount in providers.tsx | 04 |

## Definition of Ready (개발 시작 전 확인)

- [x] 모든 티켓의 Scope / FP-FN / 커버리지 매트릭스 완료
- [x] 모든 티켓에 롤백 방법 명시
- [x] 의존성 순서 확정 (위 그래프)
- [x] 데드라인 미설정 (v1.2.1 2차가 완료된 이후 진행)
- [ ] **전제 조건 — v1.2.1 2차 완료 확인** (Step 5 개발 시작 시 점검)

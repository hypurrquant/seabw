# Phase 진행 상황 - v1.3.0

## 현재 단계: Step 4 완료 — 개발 대기 (전제: v1.2.1 2차 완료)

## Phase Steps

| Step | 설명 | 상태 | 완료일 |
|------|------|------|--------|
| 1 | PRD (문제 정의) | ✅ 완료 | 2026-05-20 |
| 2 | Design (설계) | ✅ 완료 | 2026-05-20 |
| 3 | DoD (완료 조건) | ✅ 완료 | 2026-05-20 |
| 4 | Tickets (작업 분할) | ✅ 완료 | 2026-05-20 |
| 5 | 개발 | ⏳ 대기 (v1.2.1 2차 완료 후) | - |

## 결정 사항 (Step 1 사전 정렬)

- **카드 노출 위치**: 화면 중앙 모달 (`<LpProposalModal/>`)
- **실행 트리거**: AI 매개 — 유저가 카드 클릭 → seabw가 자동으로 `I choose option <N>` user 메시지를 chat 으로 재전송 → AI가 `compose_pipeline` tool_call 발행
- **카드 잔존 정책**: 새 user 메시지 입력 시 카드 모달 완전 제거 (`clearProposal`)
- **rank 의미**: `1` = AI 최고 추천, `2/3` = 대안

## 전제 (v1.2.1 2차 완료 가정)

본 phase 는 v1.2.1 2차(AI Tool Loop) 가 다음을 끝낸 상태를 전제한다:
- `@hq/react/agent` workspace link 동작
- seabw `apps/web/src/domains/agent/tools/` + `BrowserToolRegistry` 가동
- HQ 26개 tool 핸들러 (compose_pipeline 포함) 이식 완료
- `usePipelineStore` + `PipelinePreviewModal` + `executeRecipe` + wagmi 서명 동작
- SIWE 토큰이 모든 `/agent/*` 호출에 attach

전제가 깨지면 본 phase 진행 불가 — Step 4 통합 검증에서 fail-fast.

## 메모

- 2026-05-20: Step 1 시작. 사전 결정 4건 확정.
- 2026-05-20: Step 1~4 일괄 완료. PRD / Design / DoD / Tickets 산출물 작성.
- 2026-05-20: Step 5 개발 대기 — **전제 조건 v1.2.1 2차 완료 후 시작**. Definition of Ready 중 전제 조건만 미충족.

# Phase 진행 상황 - v1.1.0

## 모드: quick

## 현재 단계: ✅ 완료 (purge + slim). HQ wiring/sign loop는 v1.2.0으로 이관

## Phase Steps

| Step | 설명 | 상태 | 완료일 |
|------|------|------|--------|
| 1 | Spec (PRD+Design+DoD) | ✅ 완료 | 2026-05-20 |
| 2 | Tickets + 옛 코드 일괄 삭제 (apps/server, apps/core, 옛 components/pages) + survey/chains를 apps/web으로 흡수 | ✅ 완료 | 2026-05-20 |
| 3 | Dev — HQ /agent/chat SSE wiring, tendency prompt, sign loop, system prompt 파일 + HQ worktree env hook | ↪ v1.2.0으로 이관 | - |

## 메모
- 2026-05-20: 이전 v1.1.0-hq-lp-pipeline(vendor copy 11 step plan) 폐기.
- 2026-05-20: 추가 결정 — `apps/server`와 `apps/core` **둘 다 통째 삭제**. 모노레포는 `apps/web` 단일 워크스페이스로 축소. survey/chains/tiers 로직은 `apps/web/src/lib/`로 흡수.
- 정책: 해커톤 = 로컬 전용. HQ 패치는 worktree `feat/seabw-integration`에서만. 브랜드명은 **DefiPilot** (코드 디렉토리는 seabw).

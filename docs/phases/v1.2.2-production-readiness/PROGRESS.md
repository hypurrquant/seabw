# Phase 진행 상황 - v1.2.2

> patch (X.Y.Z) — v1.2.1 의 인프라/운영 정리 hotfix 라인. v1.3.0 은 별도 기능 phase 로 예약.

## 현재 단계: ✅ 완료

## Phase Steps

| Step | 설명 | 상태 | 완료일 |
|------|------|------|--------|
| 1 | PRD (문제 정의) | ✅ 완료 | 2026-05-21 |
| 2 | Design (설계) | ✅ 완료 | 2026-05-21 |
| 3 | DoD (완료 조건) | ✅ 완료 | 2026-05-21 |
| 4 | Tickets (작업 분할) | ✅ 완료 | 2026-05-21 |
| 5 | 개발 | ✅ 완료 | 2026-05-21 |

## 사전 결정 (4건)

- **E2E gate**: 일단 skip + DoD 에서 제외 (CI 에서 e2e suite 제외, playwright config 는 보관)
- **Workspace**: 현 구조 유지 + CI 에서 HQ worktree 를 명시적으로 clone 하는 step 추가
- **Prod chain**: HyperEVM (Hyperliquid) 단일 — `NEXT_PUBLIC_DEFAULT_CHAIN_ID=999` 강제
- **Demo flags**: prod env 에서 `NEXT_PUBLIC_DEFIPILOT_ENV=prod` + `DEFIPILOT_DEMO_BANNER=false` 강제 (런타임/빌드 검증)

## 메모

- 2026-05-21: Step 1~5 일괄 진행. P0 8건 중 7건 코드 적용, 1건(remote sync) 은 사용자 명시 요청 시.
- 2026-05-21: Step 5 개발 완료 — eslint flat config + playwright cleanup + .env.example 갱신 + next.config prod 강제 + ci.yml 신규 + HQ audit pass (0 hits).
- 2026-05-21: 자동 gate 4종 (typecheck/lint/test/build) 모두 green. HQ AGENT_AUTH_DEV_BYPASS audit pass.
- 2026-05-21: CI workflow path mismatch 패치 — actions/checkout 대신 plain `git clone` 으로 HQ 를 `$GITHUB_WORKSPACE/../../side-project/...` 에 배치 (pnpm-workspace.yaml 의 `../../side-project/...` 상대경로와 정합).

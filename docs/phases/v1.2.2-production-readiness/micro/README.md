# 작업 티켓 - v1.2.2

## 전체 현황

| # | Step | 난이도 | 롤백 | 개발 | 완료일 |
|---|------|--------|------|------|--------|
| 01 | ESLint flat config + lint script 마이그레이션 | 🟠 | ✅ | ⏳ | - |
| 02 | playwright config 정리 + e2e script 분리 | 🟢 | ✅ | ⏳ | - |
| 03 | .env.example 갱신 (HQ vars 추가, DEFI_PRIVATE_KEY 제거, prod 주석) | 🟡 | ✅ | ⏳ | - |
| 04 | next.config build-time prod env validation | 🟡 | ✅ | ⏳ | - |
| 05 | .github/workflows/ci.yml (HQ clone + 4 gate) | 🟠 | ✅ | ⏳ | - |
| 06 | HQ worktree audit (AGENT_AUTH_DEV_BYPASS grep) | 🟢 | ✅ | ⏳ | - |
| 07 | CLAUDE.md / PROGRESS 갱신 + 통합 smoke | 🟢 | ✅ | ⏳ | - |

## 의존성

```
01 (eslint) ────┐
02 (e2e) ───────┤
03 (env) ───────┼──► 07 (docs + smoke)
04 (next.cfg) ──┤        │
05 (CI) ────────┤        │
06 (HQ audit) ──┘        │
```

01~06 은 병렬 가능. 07 이 마지막 게이트.

## Step 상세

- [Step 01: ESLint flat config](step-01-eslint.md)
- [Step 02: playwright config 정리](step-02-playwright.md)
- [Step 03: .env.example 갱신](step-03-env-example.md)
- [Step 04: next.config prod validation](step-04-next-config.md)
- [Step 05: CI workflow](step-05-ci.md)
- [Step 06: HQ audit](step-06-hq-audit.md)
- [Step 07: docs + smoke](step-07-docs-smoke.md)

## 커버리지 매트릭스

### PRD 목표 → 티켓

| PRD 목표 (README.md) | 관련 티켓 | 커버 |
|----------------------|----------|------|
| 1. Lint gate 복원 | 01 | ✅ |
| 2. E2E gate 정리 | 02 | ✅ |
| 3. Workspace 재현성 (CI clone) | 05 | ✅ |
| 4. Env 정합성 | 03 | ✅ |
| 5. Prod chain 확정 | 03 (env), 04 (검증) | ✅ |
| 6. Demo flag 검증 | 04 | ✅ |
| 7. CI pipeline | 05 | ✅ |
| 8. HQ auth bypass audit | 06 | ✅ |
| 9. DEFI_PRIVATE_KEY audit | 03 | ✅ |

### DoD → 티켓

| DoD | 티켓 |
|-----|------|
| F1~F4 lint | 01 |
| F5~F6 e2e | 02 |
| F7~F10 workspace + CI | 05 |
| F11~F14 env | 03 |
| F15~F17 prod build 검증 | 04 |
| F18 HQ audit | 06 |
| N1~N5 typecheck/build/lint/test/deps | 01~07 (자기 검증) |
| N6~N8 docs/progress/commit | 07 |
| E1~E9 엣지 | 07 (수동 시연) |

### 설계 결정 → 티켓

| 결정 (design.md) | 티켓 |
|------|------|
| A2 ESLint flat config | 01 |
| B3 CI HQ clone | 05 |
| C2 next.config build throw | 04 |
| D2 playwright config 정리 | 02 |

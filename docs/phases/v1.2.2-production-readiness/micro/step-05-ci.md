# Step 05: .github/workflows/ci.yml

## 메타데이터
- **난이도**: 🟠 / **롤백**: ✅

## 구현 내용
- `.github/workflows/ci.yml` 신규:
  - trigger: push / pull_request (branches: main, develop)
  - job `verify`:
    1. checkout seabw
    2. checkout HQ worktree → `../../side-project/HypurrQuant_FE/worktrees/seabw-integration` 경로로 (token 필요)
    3. setup node 22, pnpm 9 + cache
    4. `pnpm install --frozen-lockfile` (없으면 `--no-frozen-lockfile`)
    5. `pnpm --filter @seabw/web typecheck`
    6. `pnpm --filter @seabw/web lint`
    7. `pnpm --filter @seabw/web test`
    8. `NEXT_PUBLIC_DEFIPILOT_ENV=demo pnpm --filter @seabw/web build`
  - e2e job 없음.
  - secret: `HQ_CLONE_TOKEN` (코멘트로 안내 — 등록은 사용자).

## 완료 조건
- [ ] `.github/workflows/ci.yml` 존재 (F8)
- [ ] HQ clone step 포함 (F8)
- [ ] typecheck / lint / test / build 4 gate (F9)
- [ ] e2e job 없음 (F10)

## Scope
- 신규: `.github/workflows/ci.yml`
- 신규: `.github/` 디렉토리

## FP/FN 검증
- FP: 없음
- FN: cache key 설정 누락 위험 — actions/setup-node@v4 + pnpm 표준 패턴
- 검증 통과: ✅

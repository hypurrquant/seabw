# Step 07: docs + 통합 smoke

## 메타데이터
- **난이도**: 🟢 / **롤백**: ✅

## 구현 내용
- CLAUDE.md "현재 페이즈" → v1.2.2.
- v1.2.1 을 "이전 페이즈" 로 이동.
- PROGRESS.md 모든 Step ✅.
- 통합 smoke:
  - `pnpm --filter @seabw/web typecheck` ✅
  - `pnpm --filter @seabw/web lint` ✅ (S1)
  - `pnpm --filter @seabw/web test` ✅
  - `NEXT_PUBLIC_DEFIPILOT_ENV=demo pnpm --filter @seabw/web build` ✅ (S2)
  - prod 위반 빌드 수동 1회 (S4) — 사용자 시연 또는 dry test

## 완료 조건
- [ ] CLAUDE.md 갱신 (N6)
- [ ] PROGRESS.md 갱신 (N7)
- [ ] 모든 자동 gate 통과 (N1~N4)
- [ ] S1/S2 시연 (수동 OK)

## Scope
- 수정: CLAUDE.md, PROGRESS.md

## FP/FN 검증
- FP: 없음
- FN: 없음
- 검증 통과: ✅

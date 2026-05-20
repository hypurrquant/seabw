# Step 02: import 경로 일괄 갱신

## 메타데이터
- **난이도**: 🟡
- **선행 조건**: Step 01

## 구현 내용
1. import 치환 (전 apps/web/src):
   - `@/components/landing` → `@/domains/landing/landing`
   - `@/components/survey` → `@/domains/survey/survey`
   - `@/components/tier-result` → `@/domains/survey/tier-result`
   - `@/components/connect-wallet` → `@/domains/wallet/connect-wallet`
   - `@/components/chat` → `@/domains/chat/chat`
   - `@/lib/survey` → `@/domains/survey/lib`
2. 도메인 내부 import 확인:
   - `domains/survey/survey.tsx` 안의 `@/lib/survey` → `./lib`
   - `domains/survey/tier-result.tsx` 안의 `@/lib/survey` → `./lib`
3. `pnpm typecheck` + `pnpm build` 통과 확인
4. `pnpm dev` 부팅 + `curl localhost:3000` 200 확인

## 완료 조건
- [ ] DoD N1, N2, N3, N4, N5 충족
- [ ] DoD F9 충족 (동작 변경 없음 — 수동 페이지 클릭 확인)

## Scope

### 수정 대상
- `apps/web/src/app/page.tsx` — 도메인 컴포넌트 import 경로 갱신
- `apps/web/src/domains/survey/{survey,tier-result}.tsx` — 상대경로 lib import
- `apps/web/src/domains/landing/landing.tsx` — `@/components/ui`, `@/state/app-state` 그대로
- 기타 발견 시 모두 갱신

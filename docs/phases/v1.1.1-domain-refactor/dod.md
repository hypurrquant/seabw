# DoD - v1.1.1

## 기능 완료 조건

| # | 조건 | 검증 방법 |
|---|------|----------|
| F1 | `apps/web/src/domains/{landing,survey,wallet,chat,portfolio}/` 디렉토리 존재 | `for d in landing survey wallet chat portfolio; do [ -d apps/web/src/domains/$d ] \|\| echo MISS $d; done` 출력 없음 |
| F2 | landing.tsx, survey.tsx, tier-result.tsx, connect-wallet.tsx, chat.tsx 가 각 도메인 폴더에 존재 | `for f in domains/landing/landing.tsx domains/survey/survey.tsx domains/survey/tier-result.tsx domains/wallet/connect-wallet.tsx domains/chat/chat.tsx; do [ -f apps/web/src/$f ] \|\| echo MISS $f; done` 출력 없음 |
| F3 | `apps/web/src/lib/survey.ts` 가 `apps/web/src/domains/survey/lib.ts` 로 이동됨 | `[ ! -f apps/web/src/lib/survey.ts ] && [ -f apps/web/src/domains/survey/lib.ts ]` |
| F4 | `apps/web/src/components/{landing,survey,tier-result,connect-wallet,chat}.tsx` 모두 미존재 | `for f in landing survey tier-result connect-wallet chat; do [ ! -f apps/web/src/components/$f.tsx ] \|\| echo LEFT $f; done` 출력 없음 |
| F5 | 공유 컴포넌트 4개 (`ui.tsx`, `providers.tsx`, `site-header.tsx`, `demo-banner.tsx`) 는 `components/` 에 유지 | `for f in ui providers site-header demo-banner; do [ -f apps/web/src/components/$f.tsx ] \|\| echo MISS $f; done` 출력 없음 |
| F6 | `apps/web/src/lib/{wagmi,chains,utils}.ts` 그대로 존재 | `for f in wagmi chains utils; do [ -f apps/web/src/lib/$f.ts ] \|\| echo MISS $f; done` 출력 없음 |
| F7 | `apps/web/src/state/app-state.tsx` 그대로 존재 | `[ -f apps/web/src/state/app-state.tsx ]` |
| F8 | `apps/web/src/app/{layout,page,error}.tsx` 와 `globals.css` 그대로 존재 | 각 파일 존재 확인 |
| F9 | 코드 본문 동작 변경 없음 (refactor only) — UI/카피/로직 그대로 | git diff로 import 외 변경 없음 확인 (수동) |

## 비기능 완료 조건

| # | 조건 | 검증 방법 |
|---|------|----------|
| N1 | typecheck 통과 | `pnpm typecheck` exit 0 |
| N2 | lint 통과 | `pnpm lint` exit 0 |
| N3 | build 통과 | `pnpm build` exit 0 |
| N4 | dev 부팅 OK | `pnpm dev` 후 `curl localhost:3000` 200 |
| N5 | import 잔재 없음 (`@/components/landing`, `@/components/survey`, `@/components/tier-result`, `@/components/connect-wallet`, `@/components/chat`, `@/lib/survey`) | `rg "@/components/(landing\|survey\|tier-result\|connect-wallet\|chat)\|@/lib/survey" apps/web/src` → 0 hits |
| N6 | CLAUDE.md "구조" 절 갱신 | `head CLAUDE.md` 에 새 트리 반영 |

## 엣지케이스

| # | 시나리오 | 기대 동작 |
|---|---------|----------|
| E1 | 누락된 import 발견 (빌드 실패) | 발견 즉시 같은 PR 안에서 fix |
| E2 | survey lib의 `cacheTier` 같은 함수가 다른 도메인에서 import | survey 도메인의 lib을 외부에서 import는 허용 (`@/domains/survey/lib`) — 내부 lib을 공유 export하는 것이 자연스러움 |

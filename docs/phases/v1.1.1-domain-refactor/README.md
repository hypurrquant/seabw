# 도메인 폴더 리팩토링 - v1.1.1

## 문제 정의

### 현상
- v1.1.0이 끝난 시점, `apps/web/src` 는 `app/ + components/ + lib/ + state/` 단일 평면 구조.
- 도메인 경계가 코드 트리에서 보이지 않음. 향후 chat/portfolio 도메인이 추가되면 components/ 안에 평탄하게 쌓여 의미 불명확.
- 도메인별 lib(예: `lib/survey.ts`)이 공유 lib(`lib/wagmi.ts`, `lib/chains.ts`)와 같은 폴더에 섞여 있어 도메인 응집도/공유도 구분 흐림.

### 원인
- v1.0.0~v1.1.0 동안 빠른 기능 확장 우선. 도메인 분리는 미루어둠.
- v1.1.0의 대규모 purge 이후 남은 코드량이 적어 지금이 재배치 적기.

### 영향
- v1.2.0(chat 도메인 도입)부터 도메인 신규 코드가 추가될 예정인데, 현재 평면 구조에서는 또 평탄하게 쌓여 부채 누적.
- 신규 협업자 onboarding 시 "어디서 어디까지가 한 도메인인지" 추적 비용 증가.

### 목표
1. `apps/web/src` 를 **`app/` + `domains/{landing,survey,chat,portfolio,wallet}/` + `lib/` + `components/` + `state/`** 로 재배치.
2. 기능 변경 0. 기존 동작/UI/카피 그대로.
3. 도메인 폴더 내부는 자기 도메인 한정의 components/lib만 보관. 공유 자원은 `apps/web/src/{components,lib,state}` 로 분리.
4. 빈 도메인 폴더(chat, portfolio)도 미리 만들어 v1.2.0 이후 작업을 위한 위치 확보.
5. `pnpm build`, `pnpm typecheck` 모두 통과 유지.

### 비목표 (Out of Scope)
- ❌ UI / 카피 / 디자인 변경
- ❌ 새 기능 추가 (chat, portfolio 구현은 v1.2.0+)
- ❌ 의존성 추가/제거 (refactor에 한정)
- ❌ 테스트 정책 변경 (기존 vitest 그대로)
- ❌ HQ 패치 — 본 phase는 seabw 내부 정리만

## 제약사항
- 기존 컴포넌트 코드 본문은 가능한 한 그대로 유지. 이동·import 경로 갱신만.
- TypeScript path alias `@/*` 그대로 유지 (`tsconfig.json paths`). 도메인 내부는 `@/domains/<name>/...`, 공유는 `@/lib/...`, `@/components/...`.
- 단일 PR/커밋 권장 (회귀 위험을 검증 단계에서 흡수).

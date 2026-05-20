# 설계 - v1.1.1

## 변경 규모
**규모**: 일반 기능 (refactor only)
**근거**: 다수 파일 이동 + import 경로 일괄 갱신. 동작 변경 0.

## 문제 요약
`apps/web/src`의 평면 구조를 domain-oriented 구조로 재배치. 기능 변경 0. 자세한 배경은 [README.md](README.md).

## 접근법
1. 도메인 4종 + 1 보조(`wallet`) 폴더 신설:
   - `domains/landing/` — 랜딩 페이지 UI
   - `domains/survey/` — 설문 + tier 결과
   - `domains/wallet/` — 지갑 연결 (survey와 chat 사이 단계)
   - `domains/chat/` — AI 대화 (v1.2.0 placeholder)
   - `domains/portfolio/` — 포지션 모니터링 (후속 phase placeholder)
2. 공유 인프라는 평면 유지:
   - `components/` — UI primitives + 레이아웃 (ui, providers, site-header, demo-banner)
   - `lib/` — 진짜 공유 유틸 (wagmi, chains, utils)
   - `state/app-state.tsx` — 전역 상태 (그대로)
3. `app/`은 Next.js 라우팅 얇은 진입점 (layout/page/error/globals)만 유지.
4. import 경로 일괄 변경: `@/components/{landing,survey,...}` → `@/domains/<name>/...`, `@/lib/survey` → `@/domains/survey/lib`.
5. tsconfig path alias 변경 없음 (`@/*` → `./src/*`).

## 대안 검토

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| A. 현재 평면 유지 | 작업량 0 | v1.2.0+ 부채 누적, 도메인 경계 안 보임 | ❌ |
| B. 도메인 폴더 + 평면 공유 (선택) | 도메인 응집, 공유와 분리, 표준 패턴 | 일회성 작업량 | ✅ |
| C. apps/* 워크스페이스 추가 분할 (apps/landing, apps/survey…) | 빌드 분리 가능 | next.js 단일 앱 이점 사라짐, 해커톤 과잉 | ❌ |
| D. 도메인 내부에 app router 까지 끌어옴 (Next.js parallel routes 활용) | 라우팅까지 도메인화 | 복잡도 폭증 | ❌ |

**선택 이유 (B)**: 표준 DDD-lite. Next.js 단일 앱 유지하면서 코드 트리만 도메인 단위로. 신규 도메인 추가가 명확.

## 기술 결정
- 도메인 폴더 내부 구조는 도메인 크기에 따라 자유. 작은 도메인(`landing/`)은 단일 `landing.tsx`만, 큰 도메인(`survey/`)은 `components/`, `lib/` 분리.
- `domains/<name>/index.ts` 두지 않음 (Next.js client component 트리에서 barrel re-export 이점 없음).
- import 컨벤션:
  - 도메인 내부: `@/domains/survey/lib`
  - 도메인 → 공유: `@/lib/wagmi`, `@/components/ui`
  - 도메인 → 다른 도메인: 직접 import 금지 권장 (state로만 통신). 본 phase에서는 강제하지 않음, v1.2.0 컨벤션 검토.

## 범위 / 비범위

### 범위
- 파일 이동: `components/landing.tsx`, `survey.tsx`, `tier-result.tsx`, `connect-wallet.tsx`, `chat.tsx` → 각 도메인 폴더로
- `lib/survey.ts` → `domains/survey/lib.ts`
- import 경로 갱신 (web 안에 있는 모든 importer)
- 도메인 빈 폴더 생성: `chat/`, `portfolio/` (placeholder index 또는 README 한 줄)

### 비범위
- 동작 변경, UI 변경, 카피 변경, 테스트 변경, 의존성 변경
- HQ 측 변경
- `apps/web/src/__tests__/` 추가 (없으면 추가 안 함)

## 아키텍처 개요

### 최종 트리

```
apps/web/src/
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx              # Router (stage → 도메인 컴포넌트)
│  ├─ error.tsx
│  └─ globals.css
├─ domains/
│  ├─ landing/
│  │  └─ landing.tsx        # ← components/landing.tsx
│  ├─ survey/
│  │  ├─ survey.tsx          # ← components/survey.tsx
│  │  ├─ tier-result.tsx     # ← components/tier-result.tsx
│  │  └─ lib.ts              # ← lib/survey.ts
│  ├─ wallet/
│  │  └─ connect-wallet.tsx # ← components/connect-wallet.tsx
│  ├─ chat/
│  │  └─ chat.tsx            # ← components/chat.tsx (placeholder)
│  └─ portfolio/
│     └─ .gitkeep            # 빈 placeholder
├─ components/                # 공유 UI/레이아웃
│  ├─ ui.tsx
│  ├─ providers.tsx
│  ├─ site-header.tsx
│  └─ demo-banner.tsx
├─ lib/
│  ├─ wagmi.ts
│  ├─ chains.ts
│  └─ utils.ts
└─ state/
   └─ app-state.tsx
```

### 모듈 의존 방향
- `domains/*` → `components/*`, `lib/*`, `state/*` (단방향)
- `domains/*` ↛ `domains/*` (피하기, 본 phase에선 enforcement 없음)
- `app/page.tsx` → `domains/*` (모든 도메인 진입점 import)

## 데이터 흐름
N/A (refactor only).

## API/인터페이스 계약
N/A.

## 데이터 모델/스키마
N/A.

## 테스트 전략
- 단위 테스트 변경 없음.
- 검증: `pnpm typecheck` + `pnpm build` + 수동 dev 부팅 확인 (모든 페이지 렌더링 OK).

## 실패/에러 처리
- 누락된 import 발견 시 그 자리에서 추가 갱신.

## 리스크/오픈 이슈
- **R1.** import 누락 → 빌드 실패. **완화**: rg로 일괄 점검.
- **R2.** Next.js path alias가 새 경로에 작동 안 함. **완화**: `@/*` → `./src/*` mapping 유지 (변경 없음), build 한 번 돌려 검증.

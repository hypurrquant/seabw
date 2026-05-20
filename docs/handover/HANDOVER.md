# 작업위임서 — 설문 결과 refresh 영속화 (Query Parameter 도입)

> 설문 → tier-result 화면에서 새로고침하면 React state가 날아가 landing으로 돌아감. URL query parameter에 결과를 인코딩해 refresh-safe하게 만든다.

---

## 6하원칙

### Who (누가)
- 다음 세션 (Claude / 사람 누구든)
- 필요 권한: 로컬 파일 시스템 접근, `pnpm dev` 실행 가능 환경

### What (무엇을)
- [ ] `AppStateProvider`가 mount 시 URL query parameter를 읽어 초기 stage·tier·answers를 복원
- [ ] `dispatch` 시(또는 stage 전이 시) URL을 `router.replace`로 업데이트 — history pollution 방지
- [ ] Survey 제출 후 `tier-result` 진입 시 `?stage=tier-result&tier=balanced&score=22&...` 형태로 URL 갱신
- [ ] tier-result의 모드 선택, intent → plan-review 진입 등 후속 stage 전이도 URL 동기화
- [ ] 잘못된/위조된 query parameter는 무시하고 landing으로 fallback (Zod로 검증)
- [ ] 기존 `localStorage` 캐시(`defipilot:tierResult`)와 우선순위 정리 — query > localStorage > default
- [ ] Playwright e2e (`survey-marketplace-flow`, `survey-robo-flow`) 가 URL 동기화 후에도 통과하는지 확인

### When (언제)
- 선행 조건: 없음 (즉시 가능)
- 기한: 없음 — 데모/해커톤 직전 UX 개선 작업으로 분류

### Where (어디서)
- 주 수정 파일
  - `/Users/mousebook/Documents/hypurrquant/seabw/src/state/app-state.tsx` — Provider에 URL 읽기/쓰기 추가
  - `/Users/mousebook/Documents/hypurrquant/seabw/src/app/page.tsx` — 라우터(stage 매핑) 그대로, Provider 초기값 주입 경로 점검
  - `/Users/mousebook/Documents/hypurrquant/seabw/src/lib/tiers.ts` — `cacheTier`/`readCachedTier`와 query 직렬화 helper 통합
- 관련 (수정 가능성 있음)
  - `/Users/mousebook/Documents/hypurrquant/seabw/src/components/survey.tsx` — submit 시 URL push가 Provider 쪽에서 처리되도록 검토
  - `/Users/mousebook/Documents/hypurrquant/seabw/src/components/tier-result.tsx` — 모드 선택 시 URL 갱신 경로
- 신규 (제안)
  - `/Users/mousebook/Documents/hypurrquant/seabw/src/state/url-sync.ts` — query 직렬화/역직렬화 + Zod 스키마

### Why (왜)
- 현재 `AppStateProvider`는 `useReducer`로 in-memory state만 유지 (`src/state/app-state.tsx:69` `INITIAL = { stage: "landing", ... }`).
- 사용자가 설문을 끝내고 tier-result 화면에서 새로고침하면 stage가 `landing`으로 리셋되어 처음부터 다시 풀어야 함 — 데모/실사용 모두 마찰 큼.
- `localStorage` 기반 캐시(`cacheTier` in `src/lib/tiers.ts:293`)는 이미 존재하지만 **Provider가 초기 mount 시 읽지 않음** — 절반만 구현됨.
- Query parameter로 가면 refresh-safe + 결과 공유 가능 + SSR/CSR 경계에서도 일관 (URL이 single source of truth).

### How (어떻게)
- 사용자 합의 방향: **Query parameter로 stage/tier/answers를 보존한다.**
- 구체 설계 (제안 — 다음 세션이 사용자와 최종 합의):
  - URL 스키마 예: `/?stage=tier-result&tier=balanced&score=22&dg=0&vc=0&ans=<base64-json>`
    - `stage`: 현재 단계 (`survey`/`tier-result`/`intent`/`marketplace`/...)
    - `tier`, `score`, `dg`(downgradedFromDegen), `vc`(vulnerableDowngrade)
    - `ans`: Answers 객체를 base64(JSON) 또는 단축 인코딩
  - 직렬화 헬퍼: `src/state/url-sync.ts`
    ```ts
    export const UrlStateSchema = z.object({
      stage: z.enum([...]).optional(),
      tier: z.enum(["preservation","conservative","balanced","aggressive","degen"]).optional(),
      score: z.coerce.number().int().min(0).max(100).optional(),
      dg: z.coerce.boolean().optional(),
      vc: z.coerce.boolean().optional(),
      ans: z.string().optional(), // base64-json Answers
    });
    export function encodeState(s: Partial<AppState>): URLSearchParams { ... }
    export function decodeState(params: URLSearchParams): Partial<AppState> { ... }
    ```
  - `AppStateProvider` 초기화 (Next.js App Router):
    ```ts
    "use client";
    import { useRouter, useSearchParams, usePathname } from "next/navigation";
    
    function init(): AppState {
      if (typeof window === "undefined") return INITIAL;
      const params = new URLSearchParams(window.location.search);
      const fromUrl = decodeState(params);
      if (fromUrl.tier) return { ...INITIAL, ...fromUrl };
      const cached = readCachedTier();
      if (cached) return { ...INITIAL, tier: cached.result, answers: cached.answers };
      return INITIAL;
    }
    const [state, dispatch] = useReducer(reducer, undefined, init);
    ```
  - 양방향 동기화: `useEffect`에서 state 변경 시 `router.replace(`${pathname}?${encodeState(state)}`, { scroll: false })`.
  - **민감 데이터는 URL에 싣지 않음** — `plan`, `execution`, `basket`은 stage만 보존하고 데이터는 서버에서 재조회하거나 localStorage 유지.
- 사용할 워크플로우: `/quick-phase-workflow` 또는 직접 구현 (변경 범위가 좁음)

---

## 맥락

### 현재 상태
- 브랜치: `main` (clean)
- 최근 커밋: `a1cfc80 Sign-flow step guidance`
- 테스트: 따로 돌리지 않음 (다음 세션이 baseline 확인 권장: `pnpm test`, `pnpm test:e2e`)
- 의존성: 설치 완료 후 `pnpm dev` 동작 확인됨

### 사용자 확정 결정사항
- **Query parameter로 영속화** — refresh 시에도 결과가 보존되어야 함 (사용자 직접 요구)
- 그 외(URL 스키마 형태, encoding 방식, localStorage와의 우선순위 등)은 미결정 — 구현자가 합리적 기본값 제안 후 합의

### 미결정 / 다음 세션이 합의해야 할 것
- URL에 `Answers` 전체를 base64로 실을지 vs 점수(`score`)만 실고 answers는 localStorage 유지할지
- `plan`/`basket`까지 URL에 보존할지, 아니면 tier까지만 URL이고 그 이후는 in-memory로 둘지
- `localStorage` 캐시와 URL이 충돌할 때 어느 쪽을 신뢰할지 (제안: URL 우선)
- 위조된 query (예: score 999) 들어왔을 때 — 무시? landing 리디렉트? 토스트?

### 참조 문서/코드
| 항목 | 경로 | 용도 |
|------|------|------|
| Plan (제품 스펙) | `PLAN.md` (root) | 전체 단계 정의, state machine 다이어그램 |
| State machine | `src/app/page.tsx`, `src/state/app-state.tsx` | stage 라우팅 + reducer |
| 설문 → 점수 → 티어 | `src/lib/tiers.ts` (특히 `deriveTier`, `cacheTier` L293) | tier 도출 + 기존 localStorage 캐시 |
| 설문 UI | `src/components/survey.tsx` | submit 동작 (`SET_ANSWERS` + `SET_TIER` dispatch) |
| tier-result UI | `src/components/tier-result.tsx` | 모드 선택 → `intent`/`marketplace` 전이 |
| E2E | `e2e/survey-marketplace-flow.spec.ts`, `e2e/survey-robo-flow.spec.ts`, `e2e/tier-downgrade.spec.ts` | 회귀 방지 |

---

## 주의사항
- `AppStateProvider`는 `"use client"`. `useSearchParams`는 `<Suspense>` 경계가 필요한 경우가 있으니 빌드 시 확인.
- URL 갱신은 `router.push` 아닌 **`router.replace`**로 — 매 stage 전이마다 뒤로가기 히스토리가 쌓이면 UX가 깨짐.
- `plan`은 `PipelinePlan` 통째로 크고 calldata까지 들어있어서 URL에 넣으면 안 됨 — stage만 보존하고 plan은 서버 재조회(`/api/plan/rehydrate` 이미 존재) 또는 sessionStorage로.
- `cacheTier`는 24개월 TTL — query parameter 우선 사용 시 캐시 stale 케이스 처리 (URL이 더 신선하다고 가정해도 됨).
- Playwright e2e가 URL 패턴에 의존할 수 있음 — `?stage=...` 가 붙으면 selector/assertion 재확인 필요.

## 시작 방법
1. `cd /Users/mousebook/Documents/hypurrquant/seabw && pnpm install`
2. baseline 확인: `pnpm test && pnpm test:e2e`
3. `src/state/app-state.tsx` 와 `src/lib/tiers.ts` 읽고 현재 in-memory + localStorage 흐름 파악
4. 위 "How" 섹션의 URL 스키마 / 우선순위를 사용자에게 한 번 더 확인 후 구현
5. e2e 회귀 점검 → PR

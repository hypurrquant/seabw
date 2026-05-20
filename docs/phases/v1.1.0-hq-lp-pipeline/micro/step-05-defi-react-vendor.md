# Step 05: @seabw/defi-react vendor copy

## 메타데이터
- **난이도**: 🟡 보통
- **롤백 가능**: ✅
- **선행 조건**: Step 04

---

## 1. 구현 내용

HQ `packages/react/defi/lp/**` 를 `packages/defi-react/lp/**` 로 복사 + rebrand.

### 복사 대상
| HQ 원본 | seabw 대상 |
|---|---|
| `packages/react/defi/lp/pool/hooks/{usePools,usePoolTicks,usePoolStatePolling}.ts` + 기타 hooks | `packages/defi-react/lp/pool/hooks/**` |
| `packages/react/defi/lp/pool/store/{usePoolStore,usePoolConfigStore,usePoolFavoritesStore}.ts` | `packages/defi-react/lp/pool/store/**` |
| `packages/react/defi/lp/position/hooks/{usePositions,useProgressivePositions}.ts` | `packages/defi-react/lp/position/hooks/**` |
| `packages/react/defi/lp/position/store/usePositionStore.ts` | `packages/defi-react/lp/position/store/**` |
| `packages/react/lib/react-query/query-keys.ts` (LP key만) | `packages/defi-react/lib/query-keys.ts` |
| HQ 관련 utility (react-query setup helper 등) | 필요한 경우 cherry-pick |

### 제외 대상
- `packages/react/defi/lending/**`
- `packages/react/defi/perp/**`
- 기타 telegram/world/mobile 관련 hook

### 수정 작업
- `from '@hq/core/defi/lp/*'` → `from '@seabw/defi/lp/*'`
- `from '@hq/core/lib/*'` → `from '@seabw/defi-http/*'`
- `from '@hq/react/*'` → 패키지 내부 상대 경로 또는 `from '@seabw/defi-react/*'`
- React Query Provider 셋업 코드는 본 패키지가 아닌 `apps/web` 에서 한다 (Step 10). 본 step은 hook/store 본체만.
- LP 외 query-key가 같은 파일에 섞여 있으면 LP 키만 cherry-pick

### 테스트
- HQ hook 테스트가 있다면 그대로 이식 (jsdom + @testing-library/react)
- `pnpm -F @seabw/defi-react test` 통과

## 2. 완료 조건
- [ ] `packages/defi-react/lp/pool/{hooks,store}/**` 존재
- [ ] `packages/defi-react/lp/position/{hooks,store}/**` 존재
- [ ] `rg "@hq/" packages/defi-react` → 0 hits
- [ ] `rg "defi/(lending|perp)" packages/defi-react` → 0 hits
- [ ] `pnpm -F @seabw/defi-react build` 성공
- [ ] `pnpm -F @seabw/defi-react test` 통과 (이식 테스트 있다면)
- [ ] `import { usePools, usePositions } from '@seabw/defi-react'` resolution OK

## 3. 롤백 방법
- `git checkout HEAD -- packages/defi-react/`
- 다음 step(10) 이전이면 영향 없음

---

## Scope

### 신규 생성 파일
```
packages/defi-react/lp/pool/hooks/**
packages/defi-react/lp/pool/store/**
packages/defi-react/lp/position/hooks/**
packages/defi-react/lp/position/store/**
packages/defi-react/lib/query-keys.ts
packages/defi-react/index.ts
packages/defi-react/__tests__/**       # 이식 테스트 (있다면)
```

### 수정 대상 파일
- `packages/defi-react/package.json` — peer: `react@^19`, `@tanstack/react-query@^5`, `zustand@^4.5`. dep: `@seabw/defi`, `@seabw/defi-http`

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| react 19 | peer | hook 구동 |
| @tanstack/react-query ^5 | peer | useQuery 기반 |
| zustand ^4.5 | peer | store |
| @seabw/defi | workspace dep | PoolDTO/PositionDTO/fetch 함수 |
| @seabw/defi-http | workspace dep (전이) | fetch 함수가 사용 |

### Side Effect 위험
- 위험 1: HQ react-query queryKey가 LP 외 도메인과 충돌할 수 있음. 대응: cherry-pick 시 키 prefix `lp.*`만 유지.
- 위험 2: SSR(Next.js server component)에서 zustand store 사용 시 hydration mismatch. 대응: hook 호출 컴포넌트는 모두 `"use client"` (Step 10 가이드).

### 참고할 기존 패턴
- HQ `packages/react/defi/lp/pool/hooks/usePools.ts` — react-query + zustand 결합 패턴

---

## FP/FN 검증

### False Positive
| Scope 항목 | 근거 | 판정 |
|---|---|---|
| lp/pool/hooks | 명시 | ✅ |
| lp/pool/store | 명시 | ✅ |
| lp/position/hooks | 명시 | ✅ |
| lp/position/store | 명시 | ✅ |
| lib/query-keys.ts | LP 키 cherry-pick | ✅ |

### False Negative
| 구현 내용 | Scope 포함 | 판정 |
|---|---|---|
| Lending/perp 제외 | 정책 명시 | OK |
| `@hq/` rebrand | 전 파일 일괄 | OK |
| package.json peer 갱신 | ✅ | OK |
| 테스트 이식 (선택) | ✅ | OK |
| React Query Provider 셋업 | (Step 10에서) | OK — scope 외 |

### 검증 통과: ✅

---

→ 다음: [Step 06: NestJS pipeline 도메인](step-06-pipeline-domain.md)

# Step 10: web hooks 재배선 + survey wiring

## 메타데이터
- **난이도**: 🟠 중간
- **롤백 가능**: ✅
- **선행 조건**: Step 05 (defi-react), Step 08 (server 응답 갱신)

---

## 1. 구현 내용

### A. React Query Provider 셋업
- `apps/web/src/app/providers.tsx` (또는 layout.tsx) 에 `QueryClientProvider` 추가
- 기본 staleTime 30s, gcTime 5m
- HQ 패턴 따라가서 SSR-safe 셋업

### B. LP read hook 재배선
- 기존 LP/풀 데이터 표시 컴포넌트(`apps/web/src/app/portfolio/`, `apps/web/src/components/plan-review.tsx` 등)에서
  - 기존 데이터 소스 호출 → `@seabw/defi-react`의 `usePools`, `usePoolTicks`, `usePositions`로 교체
- 컴포넌트는 `"use client"` 지시문 추가 (zustand/react-query 사용)
- 응답 shape 변경에 따른 렌더링 코드 갱신 (예: `pool.apr.totalPct` → `pool.feesApr`)

### C. wagmi 서명 트리거
- LP execution 흐름용 hook 신설: `apps/web/src/state/lp/useLpExecutionLoop.ts` (또는 비슷)
  - `/pipeline/build-step` 응답을 받아 `useSendTransaction`/`writeContract` 호출
  - `txHash` 수신 시 `/pipeline/step-complete` 호출
  - `done=true`까지 루프
  - 시그너 거절 시 codex에게 "사용자 서명 거부" 메시지 전송
- 또는 UI 패턴에 따라 codex chat 옆에서 사용자 행동(클릭/서명) 발생 시 호출

### D. Survey result → AI prompt 인젝션
- `apps/web/src/features/survey/` (또는 existing survey 위치)
  - survey 완료 후 결과를 zustand store 또는 query param으로 유지
  - chat 시작 시 첫 message payload에 tendency 텍스트 포함
  - tendency 포맷: markdown 템플릿
- chat API endpoint (`POST /agent/chat` SSE) 호출 시 body에 `metadata: { tendency: string }` 전달
- server agent.service가 시스템 프롬프트에 이를 인젝션 (Step 07의 system-prompt.service.ts 사용)

### E. env wiring
- `apps/web/.env.local.example` 에 `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` 외:
  - HQ API 호출은 server proxy 경유이므로 web env는 동일
  - codex 관련 env 없음 (server-side만)

### F. 테스트
- Playwright (이미 v1.0.0에 셋업): survey 완료 → chat 진입 → 첫 메시지에 tendency 포함 (network tab)
- LP list 렌더 smoke

## 2. 완료 조건
- [ ] `apps/web/src/app/providers.tsx` 에 QueryClientProvider 등록
- [ ] LP 화면(portfolio/risks 등)에서 `usePools`/`usePositions` 사용
- [ ] Mint 모달 클릭 → wagmi `sendTransaction` 호출 (DoD F4.7)
- [ ] Survey 결과가 chat 첫 메시지에 포함 (DoD F4.4)
- [ ] `pnpm -F @seabw/web build` 성공
- [ ] Playwright smoke 시나리오 통과
- [ ] `pnpm dev:web` 부팅 OK + 페이지 렌더링

## 3. 롤백 방법
- `git checkout HEAD -- apps/web/`
- server는 그대로 유지 (web만 v1.0.0 시점으로 — 단, 응답 shape는 갱신되어 있어 web이 깨질 수 있음 → 전체 phase 롤백 권장)

---

## Scope

### 신규 생성 파일
```
apps/web/src/app/providers.tsx                    # QueryClientProvider 셋업
apps/web/src/state/lp/useLpExecutionLoop.ts        # build-step ↔ wagmi ↔ step-complete
apps/web/src/state/lp/index.ts                     # re-export
apps/web/src/features/survey/lib/format-prompt.ts  # tendency → markdown
```

### 수정 대상 파일
```
apps/web/src/app/layout.tsx                        # providers 래핑
apps/web/src/app/portfolio/page.tsx                # usePositions/usePools 사용
apps/web/src/app/risks/page.tsx                    # usePools 사용
apps/web/src/components/plan-review.tsx            # 응답 shape 갱신
apps/web/src/components/landing.tsx                # 응답 shape 갱신 (해당 시)
apps/web/src/features/survey/<existing files>      # 결과 → chat metadata 전달
apps/web/src/lib/<chat client>                     # body.metadata.tendency 추가
apps/web/package.json                              # @seabw/defi-react, @seabw/defi, @tanstack/react-query, zustand 추가
apps/web/.env.local.example                        # env 정리
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| @seabw/defi-react | workspace dep | hook/store |
| @seabw/defi | workspace dep (전이) | PoolDTO 타입 |
| @tanstack/react-query | 신규 dep | Provider |
| zustand | 신규 dep | (defi-react peer) |
| wagmi | 기존 dep | `useSendTransaction` |

### Side Effect 위험
- 위험 1: 기존 `src/state/`, `src/components/` 에 있던 LP 관련 코드가 새 hook과 중복. 대응: 본 step에서 정리 (Scope에 포함).
- 위험 2: `"use client"` 지시문 누락 시 server component에서 hook 호출 → 빌드 실패. 대응: hook 사용 컴포넌트 grep + 일괄 추가.
- 위험 3: codex가 web과 다른 프로세스에 있으므로 "사용자 서명 거부" 메시지를 어떻게 전달? — chat 세션의 user message로 보내는 단순 방식. 대응: 별도 SSE channel 신설은 v1.2.0 백로그.
- 위험 4: SSR hydration mismatch. 대응: Provider를 client-only로 감싸기.

### 참고할 기존 패턴
- v1.0.0의 `apps/web/src/app/layout.tsx` — Provider 래핑 위치
- HQ `apps/web/src/app/providers.tsx` — Query/Wagmi Provider 셋업

---

## FP/FN 검증

### False Positive
| Scope 항목 | 근거 | 판정 |
|---|---|---|
| providers.tsx | QueryClientProvider | ✅ |
| useLpExecutionLoop.ts | build-step 루프 | ✅ |
| format-prompt.ts | tendency 변환 | ✅ |
| LP 페이지 수정 | hook 재배선 | ✅ |
| survey wiring | chat metadata | ✅ |

### False Negative
| 구현 내용 | Scope 포함 | 판정 |
|---|---|---|
| `"use client"` 일괄 추가 | grep 작업으로 포함 | OK |
| 기존 src/state LP 중복 코드 정리 | (시간상 본 step에서 모두 정리, 발견 시 Scope에 추가) | OK |
| Playwright smoke | playwright.config.ts는 이미 있음 — 시나리오만 추가 | OK |

### 검증 통과: ✅

---

→ 다음: [Step 11: DoD verify + smoke + 문서](step-11-verify-and-docs.md)

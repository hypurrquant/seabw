# 설계 - v1.3.0

## 접근법

1. **answers ↔ URL 변환 유틸 신규**: `lib/answers-url.ts`
   - `encodeAnswers(a: Answers): string` — JSON → base64url
   - `decodeAnswers(s: string): Answers | null` — base64url → JSON → `AnswersSchema.safeParse`
   - 둘 다 zod 사용. invalid → null.

2. **신규 라우트 `/chat`**: `app/chat/page.tsx`
   - `useSearchParams()` 로 `?a=` 읽음.
   - `decodeAnswers` → null 이면 `router.replace('/')`.
   - 유효하면 `deriveTier(answers)` 재계산 → `SET_ANSWERS` + `SET_TIER` 디스패치 (한 번).
   - auth 미인증이면 `router.replace('/')` (지갑 연결 + SIWE 필요).
   - 마운트되면 기존 `<aside><TierResultView readOnly /></aside> + <Chat />` 그대로 렌더.

3. **tier-result CTA 변경**: `domains/survey/tier-result.tsx`
   - 기존 `dispatch({ type: "GOTO", stage: "chat" })` 제거.
   - `router.push('/chat?a=' + encodeAnswers(state.answers!))`.

4. **stage="chat" 제거**: 
   - `state/app-state.tsx`: `Stage` 타입에서 `"chat"` 제거, `PROTECTED_STAGES` 에서 제외.
   - `app/page.tsx`: `case "chat"` 분기 제거.
   - 기존 chat stage 진입 경로 없음 (tier-result CTA 가 유일한 진입점이었음 — 위 3번에서 교체).

5. **chat 페이지의 reducer 흐름 분리**:
   - `SET_TIER`이 현재 stage 를 `"tier-result"`로 강제 전환하는 부수 효과 있음 (`app-state.tsx:83`).
   - 그러나 /chat 페이지는 URL 라우팅이라 stage state 의 영향을 안 받음.
   - 그래도 `tier-result` 페이지로 가지 못하게 영향 없는지 확인. stage 가 `tier-result` 가 되든 말든 URL 이 /chat 이면 chat page 가 그대로 렌더.

## 버린 대안
- A. 평문 query (`?horizon=4&allocation=...`) — URL 너무 길고 array 인코딩 번거로움. 채택 X.
- B. sessionId 만 — HQ 세션 만료/재시작 시 복원 불가, in-memory 의존성 잔존. 채택 X.
- C. /chat 직접 진입 시 tier-result 로 redirect — tier-result 도 stage 의존이라 그 자체가 깨짐. landing(`/`) 로 통일.

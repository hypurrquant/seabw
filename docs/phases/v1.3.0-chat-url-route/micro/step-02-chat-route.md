# Step 02: /chat 라우트

## 메타데이터
- **난이도**: 🟡
- **선행 조건**: Step 01

## 구현 내용
- `app/chat/page.tsx` 생성 (`"use client"`).
- `useSearchParams()` → `?a=` 추출 → `decodeAnswers`.
- null 또는 auth 미인증 → `router.replace('/')`.
- valid 일 때:
  - `useEffect` 안에서 `deriveTier(answers)` + `SET_ANSWERS` + `SET_TIER` 디스패치 (state.answers 미세팅일 때만).
  - 렌더: 기존 page.tsx 의 chat 분기와 동일한 split (좌 `<TierResultView readOnly />`, 우 `<Chat />`).

## 완료 조건
- [ ] URL `?a=<valid>` + authed 상태에서 split 화면 마운트.
- [ ] `?a` 없음 또는 invalid → `/` redirect.
- [ ] auth 미인증 → `/` redirect (지갑 모달 다시 띄울지는 landing 책임).
- [ ] 새로고침 후에도 첫 LLM 메시지 자동 발송 동작 (chat.tsx 의 initRef 흐름 그대로 작동).

## Scope
### 신규 생성
- `apps/web/src/app/chat/page.tsx` — 신규 라우트.

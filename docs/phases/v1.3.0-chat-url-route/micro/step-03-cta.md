# Step 03: tier-result CTA → /chat 라우팅

## 메타데이터
- **난이도**: 🟢
- **선행 조건**: Step 01, 02

## 구현 내용
- `tier-result.tsx:98` 의 `onClick={() => dispatch({ type: "GOTO", stage: "chat" })}` 변경.
- `useRouter` 도입 → `router.push('/chat?a=' + encodeAnswers(state.answers!))`.

## 완료 조건
- [ ] tier-result 화면에서 CTA 누르면 URL 이 `/chat?a=...` 로 변경.
- [ ] state.answers 가 undefined 일 때 (이론상 불가) 안전하게 가드.

## Scope
### 수정 대상
- `apps/web/src/domains/survey/tier-result.tsx` — CTA onClick 핸들러 + useRouter import.

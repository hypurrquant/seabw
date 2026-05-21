# Step 03: /chat 페이지 — prefetch gate + 로딩 UI

## 메타데이터
- **난이도**: 🟡
- **선행 조건**: Step 02

## 구현 내용
- `app/chat/page.tsx` 의 `ChatRoute` 안에서 `usePrefetchUserData(state.auth.ownerAddress)` 호출.
- 기존 hydrate (SET_ANSWERS/SET_TIER) 가 끝나면 prefetch 트리거.
- 렌더 분기:
  - prefetch.status === "loading" → 좌측 TierResultView readOnly + 우측 placeholder "지갑 분석 중…" + spinner.
  - prefetch.status === "ready" → 기존 split-screen 마운트 (Chat 컴포넌트는 이때 처음 마운트됨).
  - prefetch.status === "error" → 짧은 에러 + 재시도 버튼 (`retry()`).

## 완료 조건
- [ ] 새로고침 시 "지갑 분석 중…" 가 잠깐 보였다가 prefetch 완료 후 Chat 등장.
- [ ] Chat 의 첫 메시지 발사가 prefetch 완료 후에만 일어남 (콘솔 로그 순서로 확인).
- [ ] 에러 시 재시도 작동.

## Scope
### 수정 대상
- `apps/web/src/app/chat/page.tsx`

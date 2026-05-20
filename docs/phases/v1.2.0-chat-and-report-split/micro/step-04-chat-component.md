# Step 04: chat 컴포넌트 실제 구현

## 메타데이터
- **난이도**: 🟠
- **선행 조건**: Step 01, 03

## 구현 내용
`apps/web/src/domains/chat/chat.tsx` 갱신:

- 진입 시 useEffect:
  - state.answers + state.tier 가져와 `createSession({answers, tier})` 호출 → sessionId 저장
  - tendency markdown을 첫 user message로 자동 발송 (chatStream)
- messages 상태 + render
- input box (Enter 또는 버튼)
- chatStream 이벤트 처리:
  - `stream` → assistant 마지막 메시지에 delta append
  - `tool_call` → 즉시 `submitToolResult(sessionId, toolCallId, { status:'error', code:'TOOL_NOT_IMPLEMENTED', message:'…' })`
  - `title_update` → 무시 (또는 panel header)
  - `done` → 입력 활성화
  - `error` → 토스트 + 입력 활성화
- AbortController로 unmount 시 정리

## 완료 조건
- [ ] DoD F8, F11, F12, F13 충족
- [ ] manual smoke: HQ 부팅 후 chat 진입 → tendency 첫 메시지 자동 발송 → AI 응답 stream

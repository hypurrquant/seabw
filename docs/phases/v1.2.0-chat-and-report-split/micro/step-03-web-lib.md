# Step 03: seabw web lib 추가

## 메타데이터
- **난이도**: 🟡
- **선행 조건**: 없음 (병렬)

## 구현 내용
1. `apps/web/src/lib/hq-api.ts`
   - `createSession(profile?): Promise<string>`
   - `chatStream(sessionId, message, signal?): AsyncIterableIterator<ChatEvent>`
   - `submitToolResult(sessionId, toolCallId, result): Promise<void>`
   - SSE 파서 (event: …\ndata: …\n\n 파싱)
2. `apps/web/src/lib/tendency-prompt.ts`
   - `buildTendencyPrompt(answers, tier): string` — 첫 메시지로 보낼 markdown
   - (profile이 이미 session에 박혔으므로 보조용. 사용자가 chat에 진입했을 때 자동으로 첫 user 메시지로 발송)

## 완료 조건
- [ ] DoD F6, F7 충족
- [ ] typecheck 통과

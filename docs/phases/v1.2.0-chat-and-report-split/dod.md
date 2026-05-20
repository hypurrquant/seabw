# DoD - v1.2.0

## 기능 완료 조건

### HQ worktree 패치

| # | 조건 | 검증 방법 |
|---|------|----------|
| F1 | HQ worktree에 `AGENT_SYSTEM_PROMPT_FILE` env hook 적용 | `rg "AGENT_SYSTEM_PROMPT_FILE" /Users/mousebook/Documents/side-project/HypurrQuant_FE/worktrees/seabw-integration/apps/server/src` ≥ 1 hit |
| F2 | `POST /agent/sessions` body에 `profile?` 수용 | worktree controller에 `body.profile` 참조 grep hit |
| F3 | `AgentChatService` 가 session.profile을 system prompt에 prepend | `rg "profile" worktree/.../agent-chat.service.ts` 신규 hit |
| F4 | `AGENT_AUTH_DEV_BYPASS=1` 환경에서 `/agent/sessions` POST 가 200 응답 | curl + dev bypass env 설정 후 응답 확인 |
| F5 | worktree에 commit prefix `[seabw]` 로 변경사항 commit됨 | `git -C worktree log --oneline -5` |

### seabw web

| # | 조건 | 검증 방법 |
|---|------|----------|
| F6 | `apps/web/src/lib/hq-api.ts` 존재, `createSession`/`chatStream` export | grep export 확인 |
| F7 | `apps/web/src/lib/tendency-prompt.ts` 존재, `buildTendencyPrompt` export | grep |
| F8 | `apps/web/src/domains/chat/chat.tsx` 가 HQ `/agent/chat` SSE를 호출 | grep `/agent/chat` 또는 `chatStream` hit |
| F9 | chat stage 진입 시 화면이 좌(report) + 우(chat) split | manual: 브라우저에서 chat 진입 시 lg 이상에서 좌/우 분할 |
| F10 | tier-result 컴포넌트가 split-screen 좌측에서 read-only 형태로 표시 (또는 동등 UX) | manual |
| F11 | chat 진입 시 자동으로 HQ session 생성 + profile 동봉 | network tab: POST /agent/sessions body에 `profile.answers.horizon` 등 보이는지 |
| F12 | 사용자 메시지 입력 → HQ 응답 토큰이 stream으로 chat 패널에 표시 | manual smoke |
| F13 | `tool_call` 이벤트 발생 시 즉시 placeholder result로 응답 (앱 죽지 않음) | manual: AI가 tool 호출 시도 → 에러 없이 텍스트 응답 도착 |
| F14 | `docs/seabw-system-prompt.md` 작성됨 (DefiPilot 페르소나) | `[ -f docs/seabw-system-prompt.md ]` |

## 비기능 완료 조건
- [ ] N1 typecheck 통과 (`pnpm typecheck`)
- [ ] N2 build 통과 (`pnpm build`)
- [ ] N3 lint 통과 (`pnpm lint`)
- [ ] N4 seabw dev 부팅 OK (`pnpm dev`)
- [ ] N5 HQ worktree 부팅 OK (dev mode)
- [ ] N6 CLAUDE.md / PROGRESS.md 갱신
- [ ] N7 env 예시 갱신 (`.env.local.example`)

## 엣지케이스

| # | 시나리오 | 기대 동작 |
|---|---------|----------|
| E1 | HQ 서버 다운 | chat 우측에 "HQ 서버 연결 실패" 메시지, 앱 안 죽음 |
| E2 | profile 없이 chat 진입 (직접 URL?) | session 생성에 profile 빠진 채로 진행, LLM은 degraded 답변 |
| E3 | HQ `tool_call` 이벤트 | seabw가 즉시 placeholder result POST, LLM이 텍스트 응답 이어감 |
| E4 | 사용자가 입력 중 다른 stage로 이동 | AbortController로 SSE abort, race 안 발생 |

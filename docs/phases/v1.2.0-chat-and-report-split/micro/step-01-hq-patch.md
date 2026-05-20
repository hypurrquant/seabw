# Step 01: HQ worktree 패치

## 메타데이터
- **난이도**: 🟠
- **선행 조건**: 없음

## 구현 내용
worktree: `/Users/mousebook/Documents/side-project/HypurrQuant_FE/worktrees/seabw-integration` 의 `feat/seabw-integration` 브랜치.

### 1) `agent-chat.service.ts` — system prompt env override + profile prepend
- 기존 `AGENT_SYSTEM_PROMPT` 상수를 `DEFAULT_AGENT_SYSTEM_PROMPT` 로 rename.
- `loadSystemPrompt()` 추가: `AGENT_SYSTEM_PROMPT_FILE` env → `fs.readFileSync`, 실패 시 warn + default.
- `handleMessage()` 안에서 session profile 조회 후 system prompt 앞에 JSON 블록 prepend.

### 2) `agent.controller.ts` — `POST /agent/sessions` body에 `profile?` 수용
- `@Body() body: { profile?: unknown }` 추가
- `session.create(walletAddress, body.profile)` 로 전달

### 3) `agent-session.port.ts` + `mongo-session.adapter.ts` — Session 스키마/메서드 확장
- `create(owner, profile?)` 시그너처
- `AgentSession` 타입에 `profile?: unknown`
- mongo schema에 `profile` 필드 (Mixed)

### 4) `agent-auth.guard.ts` — `AGENT_AUTH_DEV_BYPASS` env 시 no-op
- env가 `'1'` 일 때 `req.walletAddress = process.env.AGENT_AUTH_DEV_WALLET ?? '0x0000…0abc'` 후 true 반환

### 5) commit
- 메시지 prefix `[seabw]` — 예: `[seabw] agent: env-driven system prompt + session profile + dev bypass`

## 완료 조건
- [ ] DoD F1~F5 충족
- [ ] worktree에서 `pnpm build` 성공 (회귀 없음)
- [ ] worktree에서 `pnpm dev:server` 부팅 OK (dev env 세팅 시)

# 설계 - v1.2.0

## 변경 규모
**규모**: 운영 리스크 (외부 시스템 통합 + 외부 API 변경 패치)

## 문제 요약
chat stage placeholder를 실제 HQ `/agent/chat` SSE 연동으로 교체하고, 화면을 split-screen(좌:report, 우:chat)으로 재배치하며, investor profile을 HQ 세션에 주입한다. 상세 [README.md](README.md).

## 접근법
1. **HQ 측 worktree 3개 패치**:
   a. `AGENT_SYSTEM_PROMPT_FILE` env → default system prompt 파일 override
   b. `POST /agent/sessions` body 에 `profile?: { answers, tier }` 수용 + session에 보관
   c. `AgentChatService` 가 system prompt 앞에 profile JSON 블록 prepend
   d. (보조) `AGENT_AUTH_DEV_BYPASS=1` env 시 `AgentAuthGuard` no-op
2. **seabw web 측 신규**:
   - `lib/hq-api.ts` — fetch 기반 HQ 클라이언트 (`createSession`, `chatStream`)
   - `lib/tendency-prompt.ts` — survey 결과 → 첫 user message 텍스트(폴백용)
   - `domains/chat/chat.tsx` — 실제 chat UI (messages + input)
   - `domains/chat/sse.ts` — SSE 파싱 헬퍼
3. **split-screen 라우팅**: `app/page.tsx` 의 chat case 가 좌(report)+우(chat) 2단 grid 렌더.
4. **stage 흐름 변경**: tier-result → connect-wallet → chat (현재 그대로). chat 진입 시 자동으로 HQ session 생성.

## 버린 대안

| 대안 | 단점 |
|---|---|
| profile을 매 메시지마다 동봉 | 토큰 낭비, prompt cache 깨짐 (spec이 session bind 권장) |
| profile을 첫 user message로만 전달 | LLM이 시스템 prompt와 다르게 다룸, 사용자가 메시지 삭제하면 사라짐 |
| 별도 `/agent/profile` 엔드포인트 | 신규 endpoint = HQ 패치 표면적 ↑ |
| split을 modal로 (대화 중 report 별창) | UX 단절, 동시 가독성 ↓ |

→ **session 생성 시 profile 한 번 bind + split-screen 동시 표시** 가 최소 변경에 최대 효과.

## 기술 결정

### HQ 패치 상세 (worktree)
파일 위치 (확인됨):
- `apps/server/src/domains/agent/application/agent-chat.service.ts` — `AGENT_SYSTEM_PROMPT` 상수 + `handleMessage()`
- `apps/server/src/domains/agent/interface/agent.controller.ts` — `POST /agent/sessions` (현재 body 없음)
- `apps/server/src/domains/agent/domain/agent-session.port.ts` — Session port
- `apps/server/src/domains/agent/infrastructure/mongo-session.adapter.ts` — 세션 어댑터

#### a. SYSTEM_PROMPT env override
```ts
// agent-chat.service.ts (top of file)
import * as fs from 'node:fs';
function loadSystemPrompt(): string {
  const path = process.env['AGENT_SYSTEM_PROMPT_FILE'];
  if (path) {
    try { return fs.readFileSync(path, 'utf8'); }
    catch (e) { console.warn(`[agent-chat] AGENT_SYSTEM_PROMPT_FILE read failed: ${(e as Error).message}`); }
  }
  return process.env['AGENT_SYSTEM_PROMPT'] ?? DEFAULT_AGENT_SYSTEM_PROMPT;
}
const AGENT_SYSTEM_PROMPT = loadSystemPrompt();   // 부팅 시 1회 로드 — 변경 즉시 적용 원하면 함수로 매번 호출
```

(기존 `AGENT_SYSTEM_PROMPT` 상수를 `DEFAULT_AGENT_SYSTEM_PROMPT`로 rename + `loadSystemPrompt()` 결과를 `AGENT_SYSTEM_PROMPT`로 export.)

#### b. POST /agent/sessions accepts `profile?`
```ts
// agent.controller.ts
@Post('sessions')
@UseGuards(AgentAuthGuard)
async createSession(
  @Body() body: { profile?: InvestorProfile },
  @Req() req: Record<string, unknown>
): Promise<ApiResponse<{ sessionId: string }>> {
  const walletAddress = req['walletAddress'] as string;
  const session = await this.session.create(walletAddress, body.profile);
  return { data: { sessionId: session.sessionId } };
}
```
`InvestorProfile` 타입: spec 그대로 `{ answers: Answers, tier: TierResult }` — HQ 내부 도메인 타입 재정의 또는 `Record<string, unknown>` 으로 받음. 본 phase는 HQ 도메인 가벼움 우선 — `unknown` 또는 generic JSON.

#### c. System prompt prepend
```ts
// agent-chat.service.ts handleMessage()
const session = await this.sessionPort.get(request.sessionId);
const profile = (session as { profile?: unknown })?.profile;
const profileBlock = profile
  ? `User profile (raw survey + derived tier):\n${JSON.stringify(profile, null, 2)}\n\nUse this to tailor advice. Respect tier hard limits.\n\n`
  : '';
const systemPrompt = profileBlock + AGENT_SYSTEM_PROMPT;

// llm.chat 호출 시 systemPrompt 전달
```

#### d. Auth dev bypass (옵션)
```ts
// agent-auth.guard.ts
canActivate(ctx) {
  if (process.env['AGENT_AUTH_DEV_BYPASS'] === '1') {
    const req = ctx.switchToHttp().getRequest();
    req['walletAddress'] = process.env['AGENT_AUTH_DEV_WALLET'] ?? '0x0000000000000000000000000000000000000000';
    return true;
  }
  // ... 기존 검증
}
```

### seabw web 측

#### lib/hq-api.ts
```ts
const HQ_BASE = process.env.NEXT_PUBLIC_HQ_BASE_URL ?? "http://localhost:3001";

export interface InvestorProfile {
  answers: unknown;
  tier: unknown;
}

export async function createSession(profile?: InvestorProfile): Promise<string> {
  const res = await fetch(`${HQ_BASE}/agent/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${devBearer()}` },
    body: JSON.stringify({ profile }),
  });
  const json = await res.json();
  return json.data.sessionId;
}

export interface ChatEvent {
  event: "stream" | "tool_call" | "title_update" | "done" | "error";
  data: unknown;
}

export async function* chatStream(sessionId: string, message: string, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
  const res = await fetch(`${HQ_BASE}/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${devBearer()}` },
    body: JSON.stringify({ sessionId, message }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`HQ chat HTTP ${res.status}`);
  // ... SSE 파싱 (event: ... \n data: ... \n\n)
}

function devBearer(): string {
  return process.env.NEXT_PUBLIC_HQ_DEV_BEARER ?? "dev";
}
```

#### domains/chat/chat.tsx
- messages 상태 (`{ role, content }[]`)
- 진입 시 useEffect로 HQ session 생성 (profile 동봉) → sessionId 저장
- input box → enter → chatStream 호출 → SSE 이벤트 받으며 messages 갱신
- `tool_call` 이벤트 수신 시: 본 phase는 즉시 placeholder result로 POST `/agent/tool-result` (`{status:'error', code:'TOOL_NOT_IMPLEMENTED', message:'…'}`)
- error: alert/toast
- done: 입력 활성화

#### app/page.tsx chat case
```tsx
case "chat":
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100dvh-2.5rem)]">
      <aside className="border-r border-[color:var(--color-border)] overflow-y-auto">
        <TierResultView readOnly />
      </aside>
      <section className="overflow-y-auto">
        <Chat />
      </section>
    </div>
  );
```

`TierResultView` 에 `readOnly` prop 추가 → 버튼들 숨김 (또는 별도 컴포넌트 `<ReportPanel />` 신설).

### env 추가 (seabw web)
- `NEXT_PUBLIC_HQ_BASE_URL=http://localhost:3001`
- `NEXT_PUBLIC_HQ_DEV_BEARER=dev`

### env 추가 (HQ worktree)
- `AGENT_SYSTEM_PROMPT_FILE=/abs/path/to/seabw/docs/seabw-system-prompt.md`
- `AGENT_AUTH_DEV_BYPASS=1` (데모용)
- `AGENT_AUTH_DEV_WALLET=0x0000000000000000000000000000000000000abc`

## 범위 / 비범위
PRD 참조.

## 가정/제약
- HQ apps/server는 worktree 경로에서 부팅. 포트 3001 권장 (seabw는 3000).
- codex CLI 로컬 설치 가정 (없으면 HQ `/agent/chat` 가 error 이벤트 종료).
- profile 데이터 크기 작음 (Answers 10필드 + TierResult 6필드) → JSON 직렬화 1KB 미만.

## 아키텍처 개요

```
[seabw web :3000]
   │
   ├── stage = chat 진입 시
   │     ├── HQ POST /agent/sessions  { profile: {answers, tier} }
   │     │      → { sessionId }
   │     └── 사용자 메시지 입력
   │            └── HQ POST /agent/chat (SSE) { sessionId, message }
   │                   ├── event: stream  (assistant 응답 토큰 스트림)
   │                   ├── event: tool_call  → seabw가 placeholder result로 답
   │                   └── event: done
   │
[HQ apps/server :3001]
   ├── createSession(walletAddress, profile?) — 세션 저장 (Mongo or in-memory)
   ├── /agent/chat
   │     ├── handleMessage(): system prompt = profileBlock + AGENT_SYSTEM_PROMPT
   │     │   ├── AGENT_SYSTEM_PROMPT = AGENT_SYSTEM_PROMPT_FILE 로드 or default
   │     │   └── profileBlock = session.profile JSON
   │     └── codex CLI 호출 (acpx)
   └── /agent/tool-result — placeholder 수신 (본 phase scope)
```

## 데이터 모델/스키마

### InvestorProfile (seabw → HQ)
```ts
type InvestorProfile = {
  answers: {
    horizon: 1|2|3|4;
    allocation: 1|2|3|4;
    experienceProducts: Array<"swap"|"lending"|"lp"|"leverage"|"perp">;
    experienceYears: 1|2|3|4;
    returnAttitude: 1|2|3|4;
    lossTolerance: 1|2|3|4;
    literacy: 1|2|3|4;
    derivativeExp: 1|2|3|4;
    ageBucket: "under65"|"over65";
    firstTimeDefiPilot: boolean;
  };
  tier: {
    tier: "preservation"|"conservative"|"balanced"|"aggressive"|"degen";
    rawScore: number;
    derivativeExpScore: 1|2|3|4;
    downgradedFromDegen: boolean;
    vulnerableDowngrade: boolean;
    reason?: string;
  };
};
```
seabw 측에서는 이미 `domains/survey/lib.ts` 에 동일 타입 있음.

### HQ session shape (확장)
```ts
{
  sessionId, owner, title, createdAt, updatedAt,
  profile?: InvestorProfile,   // 신규
}
```

## API/인터페이스 계약

### HQ 측 변경
- `POST /agent/sessions` — body에 `{ profile?: InvestorProfile }` 추가. 기존 호출자 무영향(optional).
- `AgentSession` 타입에 `profile?` 추가. 외부 직렬화 시 포함.

### seabw 측 신규
- 내부 SSE 이벤트 핸들러 — 외부 노출 없음.

## 테스트 전략
- **수동 smoke**:
  1. HQ worktree 부팅 (AGENT_AUTH_DEV_BYPASS=1, AGENT_SYSTEM_PROMPT_FILE=…)
  2. seabw `pnpm dev` 부팅
  3. landing → survey 완료 → tier-result → 지갑 연결 → chat 진입
  4. chat 우측 input에 "내 성향에 맞는 LP 알려줘" → HQ가 tier 인지한 답변
  5. 좌측에 tier-result 그대로 표시 확인
- **유닛 테스트**: profile prepend 정확성, hq-api SSE 파싱
- **e2e**: 본 phase 신규 작성 안 함 (해커톤)

## 실패/에러 처리

| 시나리오 | 처리 |
|---|---|
| HQ 서버 다운 | seabw web chat에 "HQ 서버 연결 실패" 토스트, 입력 비활성 |
| HQ AUTH 거부 (dev bypass 미설정) | 401 → "Auth 미설정" 토스트 + README 안내 |
| HQ chat SSE 중간 끊김 | 에러 메시지 표시 + 재전송 버튼 |
| HQ `tool_call` 발생 | placeholder result(`status:'error', code:'TOOL_NOT_IMPLEMENTED'`)로 즉시 응답 → LLM이 후속 텍스트 생성 |
| AGENT_SYSTEM_PROMPT_FILE 경로 잘못 | HQ stdout warn + DEFAULT 사용 (graceful) |
| profile 미전송 (예: 캐시 만료) | HQ가 profile 없는 상태로 동작 (degraded) |

## 롤아웃/롤백
단일 PR. 회귀 시 revert. 데이터 마이그레이션 없음.

## 관측성
- seabw web: console.log 수준
- HQ worktree: pino logger 기존 그대로

## 보안/권한
- AGENT_AUTH_DEV_BYPASS는 **dev only**. README 경고. prod에서는 정식 SIWE 흐름 필요(후속).
- profile은 PII 아님 (Answers + Tier만). wallet 정보 미포함 (spec 준수).

## 리스크/오픈 이슈
- **R1.** HQ AGENT_AUTH 가 dev bypass 외에 mongo connection 등 추가 의존 가능 — 부팅 실패 시 worktree 별도 env 조정 필요.
- **R2.** HQ가 `tool_call` 만으로도 충분한 답변 못 줄 수 있음 → 사용자 입장에서 "AI가 데이터 못 가져옴" 경험. 본 phase는 의도적 accept.
- **R3.** seabw 도메인 데이터(`Answers`, `TierResult`)를 HQ가 unknown으로 받으므로 schema drift 검출 불가 — 후속에 zod schema sync 검토.
- **R4.** Codex CLI 미설치 시 데모 실패 → README 명시.

# Step 06: Agent 도메인 이식 (chat-only, MCP 제외)

## 메타데이터
- **난이도**: 🔴 어려움
- **롤백 가능**: ✅ (모듈 단위 제거)
- **선행 조건**: Step 03

---

## 1. 구현 내용

참조 `HypurrQuant_FE/apps/server/src/domains/agent/`에서 chat-only 부분만 이식.

### 도메인 (domain/)
- `agent.types.ts`: LLMMessage, AgentSSEEvent, AgentChatRequest 등. **MCP 관련 타입(ToolResult 등) 제외**. AgentSSEEvent는 core/http/dto.ts로 export.
- `agent-llm.port.ts`: 추상 `AgentLLMPort` (그대로)
- `agent-session.port.ts`: 추상 `AgentSessionPort` (그대로 — 메서드 시그니처 보존)
- `agent-auth.port.ts`: 추상 `AgentAuthPort` (그대로)

### 어플리케이션 (application/)
- `agent-chat.service.ts`: 참조 그대로. 단, tool_call / resolveToolResult / waitForClientResult 메서드는 **제거** (MCP 미사용).
- `message-queue.ts`: 그대로 이식.

### 인프라 (infrastructure/)
- `acpx-llm.adapter.ts`: 참조 그대로 이식 (이미 우리가 검토함). MCP tool_call 매핑은 이미 swallowed → 변경 불필요.
- `in-memory-session.adapter.ts` (신규): `Map<sessionId, Session>` 기반 AgentSessionPort 구현. 모든 메서드 구현.
- `dev-stub-auth.adapter.ts` (신규): 모든 token validate 통과, `walletAddress` 으로 임의 string 사용. console.warn 한 번 출력 ("DEV STUB AUTH — DO NOT USE IN PROD").

### 인터페이스 (interface/)
- `agent.controller.ts` (축약 버전):
  - `POST /agent/chat` — `@Sse()` Observable<MessageEvent>
  - `POST /agent/sessions` — 세션 생성 (ApiResponse)
  - `GET /agent/sessions` — owner의 세션 목록 (auth stub에서 owner='dev')
  - `GET /agent/sessions/:id/messages` — 메시지 조회
  - `DELETE /agent/sessions/:id` — 세션 삭제
  - **tool-result, executeTool 엔드포인트 제외**
- `agent-auth.guard.ts`: AgentAuthPort.validateToken() 검사. stub이면 자동 통과.

> auth challenge/verify 엔드포인트도 이번엔 제외 (DevStub 단계에서 불필요). 후속 phase.

### 모듈
- `agent.module.ts`:
  - providers: AgentChatService, AgentAuthGuard, `{ provide: AgentLLMPort, useClass: AcpxLLMAdapter }`, `{ provide: AgentSessionPort, useClass: InMemorySessionAdapter }`, `{ provide: AgentAuthPort, useClass: DevStubAuthAdapter }`
  - controllers: AgentController
  - exports: AgentLLMPort, AgentAuthGuard (Step 07에서 IntentService가 LLMPort 사용)
- AppModule에 AgentModule 추가.

## 2. 완료 조건
- [ ] `apps/server/src/domains/agent/{domain,application,infrastructure,interface}/` 디렉토리 + 파일 존재 (위 목록)
- [ ] `mcp-proxy.mjs`, `hypurrquant-mcp-server.ts` 파일 없음 (`find apps/server -name "mcp*" -o -name "*mcp*"` 결과 0)
- [ ] `POST /agent/chat`이 SSE 응답 + 최소 typing/done 이벤트 송신 (acpx 부재 시 error 이벤트)
- [ ] `POST /agent/sessions` 200 + `{ data: { sessionId, owner, title } }`
- [ ] AgentLLMPort가 module 외부에서 inject 가능 (export 됨)
- [ ] unit test: `agent-chat.service` mock LLMPort/SessionPort로 stream 처리 검증
- [ ] unit test: AcpxLLMAdapter — child_process mock 으로 ENOENT 시 error event 송출 검증
- [ ] `pnpm --filter @seabw/server build` exit 0

## 3. 롤백 방법
- `apps/server/src/domains/agent/` 디렉토리 삭제
- AppModule.imports에서 AgentModule 제거

---

## Scope

### 신규 생성 파일
```
apps/server/src/domains/agent/agent.module.ts
apps/server/src/domains/agent/domain/agent.types.ts
apps/server/src/domains/agent/domain/agent-llm.port.ts
apps/server/src/domains/agent/domain/agent-session.port.ts
apps/server/src/domains/agent/domain/agent-auth.port.ts
apps/server/src/domains/agent/application/agent-chat.service.ts
apps/server/src/domains/agent/application/message-queue.ts
apps/server/src/domains/agent/infrastructure/acpx-llm.adapter.ts
apps/server/src/domains/agent/infrastructure/in-memory-session.adapter.ts
apps/server/src/domains/agent/infrastructure/dev-stub-auth.adapter.ts
apps/server/src/domains/agent/interface/agent.controller.ts
apps/server/src/domains/agent/interface/agent-auth.guard.ts
```

### 수정 대상 파일
```
apps/server/src/app.module.ts          # AgentModule imports 추가
apps/core/http/dto.ts                  # AgentChatRequest, AgentSSEEvent 정의 (이미 Step 02에서 placeholder; 여기서 실제 union 확정)
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| rxjs | server 의존 (Step 03 추가) | Observable / Subject 사용 |
| @nestjs/common | server 의존 | @Sse, @Controller 등 |
| acpx 바이너리 | 외부 | spawn 호출 |

### Side Effect 위험
- acpx 미설치 시 → chat은 error event 후 종료. server crash 없음.
- 참조의 logging adapter (`createLogger from '@hq/core/logging'`) — 우리는 `Logger from '@nestjs/common'` 또는 console로 대체. 또는 `apps/server/src/lib/logger.ts`로 간단 export.

### 참고할 기존 패턴
- 참조 그대로. 단, mongoose import / Mongoose 데코레이터 / `@nestjs/mongoose` 의존성은 모두 제거하고 in-memory adapter로 대체.
- 참조의 sse-subject 패턴 (`Subject<AgentSSEEvent>` → controller에서 map(event => ({ data: event }))).

## FP/FN 검증

### FP
- `infrastructure/schemas/chat-session.schema.ts` — Mongo 의존. 비범위 ✅ 제외.
- `mcp-proxy.mjs` — MCP 비범위 ✅ 제외.
- `agent-auth.controller.ts` — auth 강화 비범위 ✅ 제외.

### FN
- AgentAuthGuard 등록 — controller에 `@UseGuards(AgentAuthGuard)` 적용. Auth는 stub이라 통과만. 명시 ✅.
- IntentService — Step 07에서 처리 ✅.
- SessionQueueManager 메시지 큐 동작 — 명시 ✅.
- agent chat에 systemPrompt 주입 — Service에서 default systemPrompt 정의 (어드바이저 톤). 명시 ✅.

### 검증 통과: ✅

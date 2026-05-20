# 설계 - v1.0.0 (Monorepo + Codex)

## 변경 규모

**규모**: 운영 리스크
**근거**:
- 아키텍처 전환 (Next.js 단일 앱 → pnpm 모노레포 + NestJS 분리) → "서비스 경계" 트리거
- API 6개의 호스트가 바뀜 (same-origin → 별도 서버 포트) → "프로덕션 배포 영향"
- 외부 바이너리 의존 추가 (`acpx`, `codex-acp`) → "런타임 의존성 변경"
- LLM 호출 경로 전환 (Anthropic SDK → spawn 기반 SSE) → 실패 모드 변경
- 자동 승격 규칙: 내부 API 변경(클라이언트가 부르는 base URL) + 데이터 흐름(SSE 추가) → 최소 "운영 리스크"

> "서비스 경계" 까지는 올리지 않음. 같은 레포·같은 팀 소유로 외부 계약/타 팀 의존 없음.

---

## 문제 요약

seabw는 단일 Next.js 앱에 서버/UI/도메인이 결합되어 있고, LLM 호출이 Anthropic SDK에 직접 묶여 있다. 참조 프로젝트(HypurrQuant_FE)의 NestJS DDD + codex(acpx) agent 패턴으로 정렬해 (1) 서버/웹/코어 책임을 분리하고 (2) 대화·intent 파싱을 codex로 통합한다.

> 상세: [README.md](README.md) 참조

---

## 접근법

### 핵심 아이디어
1. **pnpm workspace 모노레포로 리포 재구성**: 레포 루트를 모노레포로 전환하고 `apps/{server, web, core}` 3개 워크스페이스를 추가. 기존 `src/`는 휴면 상태로 보존(삭제 금지).
2. **NestJS 11 서버를 신설(apps/server)** 하고 기존 6개 API Route 책임을 4개 도메인 모듈(`plan`, `marketplace`, `precheck`, `portfolio`)로 분리. 추가로 `agent` 도메인을 참조 프로젝트에서 이식해 SSE 대화 엔드포인트와 intent 파서를 제공.
3. **`apps/core`(`@seabw/core`)**: 도메인 타입·스키마·체인 메타 + API 경계 DTO(요청·응답)를 SSOT로 정의. server와 web 양쪽이 동일 타입을 import.
4. **Codex 이식**: HypurrQuant_FE의 `domains/agent` 중 `domain/`, `application/`, `infrastructure/acpx-llm.adapter.ts`, `interface/agent.controller.ts`(SSE 부분만), `agent.module.ts` 만 가져온다. MCP tool·MongoDB 영속화·hypurrquant-mcp-server.ts는 제외. Session/Auth는 인메모리 stub.
5. **Anthropic SDK 제거**: `src/agent/intent.ts`의 LLM 호출을 server 내부 `IntentService`로 이동하고, `AgentLLMPort.chat()`을 통해 codex로 호출. JSON 출력 system prompt + 스트림 누적 후 파싱. 휴리스틱 fallback 보존.
6. **apps/web에서 API Route 제거**: Next.js는 UI만. 모든 fetch 호출을 `http<T>()` 헬퍼로 통합하고 base URL을 `NEXT_PUBLIC_API_BASE_URL`(개발: `http://localhost:4000`) 로 향하도록 환경 분리.

---

## 대안 검토

### A. 단일 Next.js 유지 + Anthropic만 codex로 교체
- 장: 변경 폭 최소, 1-2일이면 완료.
- 단: 모노레포·NestJS·core 패키지 등 요청한 목표 전부 미달성. PRD의 핵심을 만족 못 함.
- 선택: ❌

### B. 모노레포 + NestJS 분리 + 점진적 dual-write
- 장: 안전(클라이언트가 same-origin과 NestJS를 동시에 사용하다 cutover).
- 단: 임시 라우팅·이중 배포·재작업. 사용자가 "한 번에"를 명시.
- 선택: ❌

### C. 모노레포 + NestJS 분리 + 한 번에 cutover (Recommended)
- 장: 사용자 요청에 정합. 깨끗한 최종 형태. `src/`는 보존되어 롤백/참고 가능.
- 단: 동일 시점에 서버·웹 동시 변경. 테스트 부담↑.
- 선택: ✅

### D. NestJS 대신 가벼운 별도 서버(Fastify/Hono) + 동일 모노레포
- 장: 부팅·번들 가벼움.
- 단: 참조 프로젝트(HypurrQuant_FE)와의 DDD/Module/DI 정합성 손실. 이식이 어색해짐. agent 도메인 코드를 대량 재작성해야 함.
- 선택: ❌

---

## 기술 결정

| 항목 | 결정 | 근거 |
|------|------|------|
| 패키지 매니저 | **pnpm 10** workspace | 참조 프로젝트 동일 |
| 서버 프레임워크 | **NestJS 11** + SWC builder | 참조 동일, agent 이식 비용↓ |
| 빌드 도구 | `nest build`(SWC), Next.js 기본, core는 `tsc --noEmit` + 소스 직접 export | core는 라이브러리 → `index.ts`를 main/types 로 두고 빌드 산출물 없이 소스 공유 (참조 `@hq/core`와 동일) |
| 모노레포 도구 | pnpm-workspace.yaml + 루트 scripts (Turbo/Nx 미사용) | 참조 동일, 최소화 |
| 패키지명 | `@seabw/core`, `@seabw/server`(private), `@seabw/web`(private) | "seabw" prefix |
| 노드 버전 | ≥ 20 | NestJS 11 / Next 15 / 참조 동일 |
| HTTP 클라이언트(web) | `fetch` 기반 thin wrapper `http<T>()` | 의존성 최소, 참조의 `http` 헬퍼 패턴 |
| SSE | NestJS `@Sse()` + RxJS Observable | 참조 동일 (acpx 이벤트 직접 매핑) |
| Codex 실행 | `spawn('acpx', ...)` adapter 그대로 이식 | 참조의 `AcpxLLMAdapter` 사용 |
| Session 저장 | **인메모리 Map adapter** (`InMemorySessionAdapter`) | MongoDB 영속화는 비범위 |
| Auth | **DevStubAuthAdapter** (모두 통과, 사용자 식별만 placeholder) | 인증 강화는 비범위. AgentAuthPort 인터페이스는 유지 |
| Intent 출력 | LLM에 "JSON only" system prompt → 스트림 텍스트 누적 후 `JSON.parse` + ParsedIntentSchema 검증 + 실패 시 휴리스틱 fallback | acpx는 tool-use 미지원 (agent_message_chunk만 매핑) |
| API base URL(web→server) | dev: `http://localhost:4000`, prod: env `NEXT_PUBLIC_API_BASE_URL` | Next.js rewrites 옵션도 있지만 단순 env가 디버깅 쉬움 |
| 응답 envelope | `ApiResponse<T> = { ok: true, data: T } \| { ok: false, error: { code, message } }` | 참조 패턴. 기존 6개 route의 외부 shape 호환을 위해 `data` 페이로드 모양은 기존과 동일하게 유지 |
| 포트 | server 4000, web 3000 | dev 충돌 없음 |
| 환경변수 | `ANTHROPIC_API_KEY` 제거, `AGENT_TOKEN_SECRET`/`AGENT_STORAGE_MODE` 보류(stub이므로 unused), `DEFIPILOT_ENV` 그대로 | |

---

## 범위 / 비범위

### 범위 (In Scope)
- 루트 모노레포화 + `apps/{server,web,core}` 신설
- 6개 API Route → NestJS controller 이전 (외부 path/shape 유지, host만 변경)
- core 패키지 SSOT: types/schemas/config/ApiResponse 정의, server·web 양쪽 import
- agent 도메인 이식 (chat-only): controller(SSE 한 엔드포인트) + service + LLMPort + acpx adapter + InMemorySessionAdapter + DevStubAuthAdapter + AgentAuthGuard(스텁)
- Anthropic SDK 제거 (의존성·env·코드 전부)
- 휴면 src/ 보존 (수정/삭제 없음)
- 기존 vitest 테스트들의 신규 위치 이식 + 통과

### 비범위 (Out of Scope)
- src/ 삭제
- MongoDB / Redis 도입
- AgentAuth 실서명 검증, 챌린지 영속화
- MCP tool 서버 (`hypurrquant-mcp-server.ts`) 이식
- LLM-driven plan composition
- Docker / CI 파이프라인 변경
- e2e(Playwright) 신규 시나리오 (포트·baseURL 조정만)
- landing/모바일 워크스페이스

---

## 가정/제약

- **로컬 환경**: 개발자 머신에 `acpx` 바이너리가 PATH에 존재한다고 가정. 없으면 server 부팅은 성공하지만 `AgentLLMPort.chat()` 호출 시 spawn 실패 → `error` SSE 이벤트로 종료 후 IntentService가 휴리스틱 fallback으로 회복.
- **포트 4000**: 개발 환경에서 가용하다고 가정. 충돌 시 `.env`로 변경 가능.
- **공용 src/ 미사용**: tsconfig path/include에서 src/를 제외하지 않으면 모노레포 빌드가 `src/` 코드까지 컴파일하려 함 → 루트 tsconfig에서 명시적으로 exclude.
- **defi-cli 외부 바이너리**: 기존과 동일하게 server에서 spawn. core/web은 의존하지 않음.

---

## 아키텍처 개요

### 최종 디렉토리 트리

```
seabw/
├── package.json                # 루트 (workspace 정의 + 공통 scripts)
├── pnpm-workspace.yaml         # apps/*
├── tsconfig.base.json          # 공통 strict 설정
├── apps/
│   ├── core/                   # @seabw/core
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── index.ts            # 모든 export
│   │   ├── types/              # ← src/types 이전
│   │   ├── schemas/            # ← src/schemas 이전
│   │   ├── config/             # ← src/config 이전
│   │   ├── http/
│   │   │   ├── api-response.ts # ApiResponse<T> envelope
│   │   │   └── dto.ts          # 6개 API의 req/res DTO 타입
│   │   └── lib/                # 순수 함수 (tiers, risk 등)
│   ├── server/                 # @seabw/server (NestJS)
│   │   ├── package.json
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── bootstrap/
│   │       │   └── main.ts     # NestFactory + cors + ValidationPipe
│   │       ├── app.module.ts
│   │       ├── domains/
│   │       │   ├── plan/                          # POST /api/plan, /api/plan/rehydrate
│   │       │   │   ├── plan.controller.ts
│   │       │   │   ├── plan.service.ts
│   │       │   │   ├── plan.module.ts
│   │       │   │   └── internal/
│   │       │   │       ├── composer.ts            # ← src/agent/composer.ts
│   │       │   │       ├── basket-composer.ts     # ← src/agent/basket-composer.ts
│   │       │   │       ├── tools.ts               # ← src/agent/tools.ts
│   │       │   │       ├── prices.ts              # ← src/lib/prices.ts
│   │       │   │       ├── plan-store.ts          # ← src/lib/planStore.ts
│   │       │   │       ├── audit-log.ts           # ← src/lib/auditLog.ts
│   │       │   │       ├── guardrails.ts          # ← src/policy/guardrails.ts
│   │       │   │       └── whitelist.ts           # ← src/policy/whitelist.ts
│   │       │   ├── marketplace/                   # GET /api/marketplace/yields, POST /api/marketplace/plan
│   │       │   │   ├── marketplace.controller.ts
│   │       │   │   ├── marketplace.service.ts
│   │       │   │   ├── marketplace.module.ts
│   │       │   │   └── internal/
│   │       │   │       └── yields.ts              # ← src/lib/yields.ts
│   │       │   ├── precheck/                      # POST /api/precheck
│   │       │   │   ├── precheck.controller.ts
│   │       │   │   ├── precheck.service.ts
│   │       │   │   ├── precheck.module.ts
│   │       │   │   └── internal/
│   │       │   │       └── sanctions.ts           # ← src/policy/sanctions.ts
│   │       │   ├── portfolio/                     # GET /api/portfolio/health
│   │       │   │   ├── portfolio.controller.ts
│   │       │   │   ├── portfolio.service.ts
│   │       │   │   ├── portfolio.module.ts
│   │       │   │   └── internal/
│   │       │   │       └── risk.ts                # ← src/lib/risk.ts (pure parts) 또는 core
│   │       │   └── agent/                         # POST /agent/chat (SSE) + intent
│   │       │       ├── agent.module.ts
│   │       │       ├── domain/
│   │       │       │   ├── agent.types.ts
│   │       │       │   ├── agent-llm.port.ts
│   │       │       │   ├── agent-session.port.ts
│   │       │       │   └── agent-auth.port.ts
│   │       │       ├── application/
│   │       │       │   ├── agent-chat.service.ts
│   │       │       │   ├── intent.service.ts      # 신설 - parseIntent via LLMPort
│   │       │       │   └── message-queue.ts
│   │       │       ├── infrastructure/
│   │       │       │   ├── acpx-llm.adapter.ts
│   │       │       │   ├── in-memory-session.adapter.ts
│   │       │       │   └── dev-stub-auth.adapter.ts
│   │       │       └── interface/
│   │       │           ├── agent.controller.ts
│   │       │           └── agent-auth.guard.ts
│   │       ├── lib/
│   │       │   ├── defi-cli.ts                    # ← src/lib/defiCli.ts (server only)
│   │       │   └── ratelimit.ts                   # ← src/lib/ratelimit.ts
│   │       └── common/
│   │           ├── api-response.util.ts           # ApiResponse 래핑 helper
│   │           └── exception-filter.ts            # uniform error envelope
│   └── web/                    # @seabw/web (Next.js)
│       ├── package.json
│       ├── next.config.ts
│       ├── tsconfig.json
│       ├── public/             # ← 루트 public 이전
│       └── src/
│           ├── app/            # ← src/app/ 에서 api/ 제외하고 이전
│           │   ├── layout.tsx
│           │   ├── page.tsx
│           │   ├── error.tsx
│           │   ├── portfolio/
│           │   └── risks/
│           ├── components/     # ← src/components 이전
│           ├── state/          # ← src/state 이전
│           └── lib/
│               ├── http.ts     # 신설 - fetch wrapper
│               ├── wagmi.ts    # ← src/lib/wagmi.ts
│               └── utils.ts    # ← src/lib/utils.ts
└── src/                        # 휴면 — 그대로 보존
```

### 모듈 의존 방향
```
apps/web ──depends─→ @seabw/core
   │                    ▲
   │ HTTP (fetch)       │
   ▼                    │
apps/server ──depends──┘
    │
    ├── spawn → acpx → codex-acp (외부)
    └── spawn → defi-cli (외부)
```

- core는 어디에도 의존하지 않음 (zod 외부)
- web ↛ server (소스 import 금지, HTTP만)
- server ↛ web

---

## 데이터 흐름

### 일반 요청 흐름 (예: POST /api/plan)

```
[apps/web/components/intent-input.tsx]
  → http<PlanResponse>({ url: '/api/plan', method: 'POST', body: req })
    → fetch(`${NEXT_PUBLIC_API_BASE_URL}/api/plan`)
        → [apps/server PlanController.create]
              → PlanService.compose(req)
                  → IntentService.parse(text)
                      → AgentLLMPort.chat({ systemPrompt: JSON_ONLY, messages, context })
                          → AcpxLLMAdapter spawn('acpx', ...) → JSON stream
                              → 누적 → JSON.parse → ParsedIntentSchema.parse
                                  (실패 시 parseIntentHeuristic())
                  → composePlan(tier, intent, opts)  // 결정론 (composer.ts)
                  → evaluatePlan(plan)
                  → rememberPlan(plan)
              → ApiResponse.ok({ plan })
        ← JSON
    ← PlanResponse
```

### Agent 대화 흐름 (POST /agent/chat — 신규)

```
[client] POST /agent/chat { sessionId, message }
  → AgentController.chat → @Sse() Observable<MessageEvent>
      → AgentChatService.processMessage
          → SessionQueueManager.enqueue
          → InMemorySessionAdapter.getMessages → history
          → AgentLLMPort.chat({ messages, ... }) → Observable<AgentSSEEvent>
              → events: typing | stream(delta) | done | error
          → assistantContent 누적
          → InMemorySessionAdapter.appendMessage(user) + appendMessage(assistant)
      ← SSE 스트림
```

---

## API/인터페이스 계약

기존 6개 + 신규 1개. 외부 path/shape는 기존과 호환 (envelope 미적용 또는 envelope 있더라도 클라이언트는 `.data`로 unwrap).

### 1. POST /api/plan
- **Body** (`@seabw/core` `PlanRequest`): `{ tier: Tier, scores: number[], intentText: string, wallet?: string }`
- **Response** (`PlanResponse`): `{ plan: PipelinePlan }`

### 2. POST /api/plan/rehydrate
- **Body**: `{ planId: string, signerAddress: string }`
- **Response**: `{ plan: PipelinePlan }`

### 3. GET /api/marketplace/yields?tier=Tier
- **Response**: `{ tier: Tier, count: number, products: YieldProduct[] }`

### 4. POST /api/marketplace/plan
- **Body**: `{ tier: Tier, basket: BasketItem[], wallet?: string }`
- **Response**: `{ plan: PipelinePlan }`

### 5. POST /api/precheck
- **Body**: `{ planId: string, stepId: string, signerAddress: string }`
- **Response**: `{ ok: true, canonicalCalldata?: ... } | { ok: false, reason: string }`

### 6. GET /api/portfolio/health?address=string&chainId=number
- **Response**: `{ health: PortfolioHealth }`

### 7. POST /agent/chat  (신규, SSE)
- **Body** (`AgentChatRequest`): `{ sessionId: string, message: string }`
- **SSE Events** (`AgentSSEEvent`):
  - `typing` — `{}`
  - `stream` — `{ delta: string }`
  - `done` — `{ sessionId: string }`
  - `error` — `{ code: string, message: string }`

> 세션 CRUD/Auth 컨트롤러는 이번 phase에서는 stub 수준만 제공 (POST /agent/sessions만 가능, 다른 메서드는 후속). 사용자가 명시한 "대화 유지" 용도에 최소 필요.

---

## 데이터 모델/스키마

- **AgentSession (in-memory)**: `Map<sessionId, { owner: string; title: string; messages: { role, content, ts }[] }>`. 프로세스 재시작 시 휘발.
- **PipelinePlan** 등: 기존 `@seabw/core/types`에서 그대로 (변경 없음).

DB 스키마 변경 없음.

---

## 테스트 전략

| 레벨 | 위치 | 범위 |
|------|------|------|
| Unit (server) | `apps/server/src/**/__tests__` (vitest) | `composer.ts`, `basket-composer.ts`, `whitelist.ts`, `guardrails.ts`, `sanctions.ts`, `tiers.ts`, `prices.ts`, `yields.ts`, `planStore.ts`, `ratelimit.ts`, `intent.service.ts` (LLM mock) |
| Integration (server) | `apps/server/src/domains/**/__tests__/*.controller.test.ts` | Nest TestingModule로 6개 controller 부팅 + supertest로 status/shape 검증 (LLMPort는 mock) |
| Unit (core) | `apps/core/**/__tests__` | 스키마 validation 라운드트립, ApiResponse 헬퍼 |
| E2E (Playwright) | `e2e/` | 기존 시나리오 — baseURL/포트만 조정. 신규 SSE 시나리오 없음. |
| Manual | 로컬 | `pnpm dev` 두 워크스페이스 부팅 → 브라우저 골든 패스 |

기존 25개 테스트 파일은 모두 새 위치로 이전. 경로 alias 갱신.

---

## 실패/에러 처리

| 실패 모드 | 대응 |
|----------|------|
| `acpx` 바이너리 없음 | spawn 시 `ENOENT` → `error` SSE 이벤트 + IntentService는 휴리스틱 fallback |
| codex가 비-JSON 응답 | 누적 텍스트에서 JSON 블록 추출 시도 → 실패 시 휴리스틱 fallback |
| `defi-cli` 호출 실패 | 기존 동작 유지 (composer에서 calldata 미설정 + demo 모드 통과 / prod 모드 reject) |
| 잘못된 body | `ZodValidationPipe`로 400 + 에러 envelope |
| 5xx | NestJS exception filter → `{ ok: false, error: { code, message } }` 일관 envelope |
| 포트 충돌 | dev 시 자동 종료 + 명확한 에러 메시지 (`PORT=4000 이미 사용 중`) |

---

## 롤아웃/롤백 계획

- **롤아웃**: 단발 PR/커밋 묶음으로 cutover.
- **롤백**: src/가 보존되어 있으므로 (1) apps/web의 NEXT_PUBLIC_API_BASE_URL 제거 + Next.js API Route를 src/에서 복구 (2) 모노레포 설정 revert. 또는 단순히 git revert.

---

## 관측성

- 서버 로그: NestJS 기본 `Logger` + `pino`(참조와 동일) — agent SSE는 spawn/이벤트 로그 stdout.
- 메트릭: 신규 추가 없음 (이번 phase 비범위).
- spawn 디버깅: `[acpx-adapter] stderr:` 프리픽스 그대로 유지.

---

## 보안/권한

- AgentAuthGuard는 stub 단계 (`DevStubAuthAdapter.validateToken()`이 비-empty면 통과). dev에서 어떤 Bearer 토큰을 쓰든 OK. **프로덕션 배포 전 실구현 교체 필요** — Phase DoD에 명시.
- 기존 6개 API는 인증 없음 그대로 유지(기존 동일).
- ratelimit은 server `lib/ratelimit.ts`에서 그대로 (메모리 기반).

---

## 성능/스케일

- N/A: 이번 phase는 구조 변경. 처리량·응답시간 목표 변경 없음. acpx spawn 비용(수백 ms~)은 intent 한 번 호출만이라 기존 Anthropic SDK 호출(~수 초)보다 빠를 가능성. 측정은 후속.

---

## 리스크/오픈 이슈

| # | 리스크 | 대응 |
|---|-------|------|
| R1 | acpx 미설치 환경에서 intent 파싱이 항상 휴리스틱으로 떨어짐 | README에 설치 절차 명시. CI에서는 휴리스틱 fallback이 동작함을 검증. |
| R2 | 루트 tsconfig가 src/와 apps/ 둘 다 잡아 빌드 오염 | 루트 tsconfig include/exclude를 워크스페이스별로 분리. 루트는 references 만. |
| R3 | 기존 `@/*` alias가 src/ 를 가리키는데 새 워크스페이스는 alias가 달라짐 | apps/* 각자 `@/*` alias를 자기 src로 정의. 충돌 없음. |
| R4 | Playwright baseURL 변경으로 e2e 깨질 가능성 | `playwright.config.ts`에 webServer 두 개(web/server) 등록. 실패 시 시나리오 별로 skip 등록 후 후속 phase에서 수정. |
| R5 | session in-memory → 서버 재시작 시 대화 유실 | 명시적 비범위. README에 "휘발성" 경고. |
| R6 | acpx stdin/stdout 인터페이스 변경 가능성 (외부 의존) | 어댑터 코드는 참조 프로젝트 최신 버전을 그대로 복사. 버전 핀(0.5.x) |
| R7 | core가 zod 외 의존 늘어나면 web 번들 비대화 | core에 viem/react 금지. lint 규칙으로 강제(후속) |

# DoD (Definition of Done) - v1.0.0

## 기능 완료 조건

### 모노레포 구조

| # | 조건 | 검증 방법 |
|---|------|----------|
| F1 | 루트에 `pnpm-workspace.yaml` 존재, `apps/*` 포함 | `cat pnpm-workspace.yaml` |
| F2 | `apps/core`, `apps/server`, `apps/web` 3개 워크스페이스가 `pnpm -r ls --depth -1` 결과에 노출됨 | `pnpm -r ls --depth -1` |
| F3 | 루트 `package.json`에 `dev`, `dev:server`, `dev:web`, `build`, `build:server`, `build:web`, `test`, `lint` 스크립트 정의 | `node -e "console.log(Object.keys(require('./package.json').scripts))"` |
| F4 | 기존 `src/` 디렉토리가 그대로 보존 (파일 수/이름 변동 없음) | `find src -type f \| wc -l` 결과가 phase 시작 시점과 동일 |

### apps/core 패키지

| # | 조건 | 검증 방법 |
|---|------|----------|
| F5 | `@seabw/core` 라는 이름으로 published name 등록 | `cat apps/core/package.json \| jq -r .name` → `@seabw/core` |
| F6 | `apps/core/index.ts` 가 types/schemas/config/http/lib 전부 re-export | `npx tsx -e "import * as core from './apps/core'; console.log(Object.keys(core).length > 10)"` |
| F7 | `ApiResponse<T>` 타입 정의 존재 (success/error 두 variant) | `grep -n "ApiResponse" apps/core/http/api-response.ts` |
| F8 | 6개 API의 request/response DTO 타입이 `apps/core/http/dto.ts`에 정의 (PlanRequest/Response, MarketplaceYields*, MarketplacePlan*, PrecheckRequest/Response, PortfolioHealthResponse, RehydrateRequest/Response) | `grep -c "export (type\|interface)" apps/core/http/dto.ts` ≥ 12 |
| F9 | core에 React/Next/viem/wagmi 등 UI 의존성이 들어가지 않음 | `cat apps/core/package.json \| jq -r '.dependencies\|keys[]'` → zod 외 frontend lib 없음 |

### apps/server (NestJS)

| # | 조건 | 검증 방법 |
|---|------|----------|
| F10 | NestJS 11 + SWC 빌더로 `nest build` 성공 | `pnpm --filter @seabw/server build` exit 0 |
| F11 | `nest start --watch` 또는 `pnpm dev:server` 부팅 시 4000 포트 listen + `/api/portfolio/health` GET 200 | `curl -s "http://localhost:4000/api/portfolio/health?address=0x0&chainId=1"` |
| F12 | 다음 6개 controller endpoint 가 등록됨: POST /api/plan, POST /api/plan/rehydrate, GET /api/marketplace/yields, POST /api/marketplace/plan, POST /api/precheck, GET /api/portfolio/health | `curl -s -o /dev/null -w "%{http_code}\n"` 각각 4xx/2xx (404 아님) |
| F13 | 신규 SSE endpoint: POST /agent/chat — body `{ sessionId, message }`, `Content-Type: text/event-stream`, 최소 `typing`, `done` 이벤트 송신 | `curl -N -X POST localhost:4000/agent/chat -H 'Content-Type: application/json' -d '{"sessionId":"s","message":"hi"}'` 로 SSE 라인 확인 |
| F14 | controller method 의 return type / body type annotation이 core 타입을 직접 사용 (서버 내부 inline 타입 금지) | `grep -rn "@Body" apps/server/src/domains/**/*.controller.ts` 결과의 모든 param 이 core 타입 |
| F15 | `composer.ts`, `basket-composer.ts`, `guardrails.ts`, `whitelist.ts`, `sanctions.ts`, `prices.ts`, `yields.ts`, `planStore.ts`, `auditLog.ts`, `tools.ts` 가 server 내부로 이전 + 기존 동작 보존 | `apps/server/src/domains/**` 경로 존재 확인 + 해당 모듈 vitest 통과 |
| F16 | server 내부 어디서도 `@anthropic-ai/sdk` import 없음 | `grep -rn "@anthropic-ai/sdk" apps/server/src` → 결과 0 |

### Agent 도메인 (Codex 이식, MCP 제외)

| # | 조건 | 검증 방법 |
|---|------|----------|
| F17 | `apps/server/src/domains/agent/{domain,application,infrastructure,interface}/` 디렉토리 존재 | `ls apps/server/src/domains/agent/{domain,application,infrastructure,interface}` |
| F18 | `AgentLLMPort`, `AgentSessionPort`, `AgentAuthPort` 추상 클래스 정의 | `grep -ln "abstract class Agent" apps/server/src/domains/agent/domain/*.port.ts` 3개 |
| F19 | `AcpxLLMAdapter`가 `AgentLLMPort` 구현 + `spawn('acpx', ...)` 호출 | `grep -n "spawn('acpx'" apps/server/src/domains/agent/infrastructure/acpx-llm.adapter.ts` |
| F20 | `InMemorySessionAdapter`가 `AgentSessionPort` 구현, 프로세스 메모리 Map 기반 | `grep -n "new Map" apps/server/src/domains/agent/infrastructure/in-memory-session.adapter.ts` |
| F21 | `DevStubAuthAdapter`가 `AgentAuthPort` 구현 (모든 token validate 통과 / dev 전용 경고 로그) | `grep -n "DevStubAuthAdapter" apps/server/src/domains/agent/infrastructure/dev-stub-auth.adapter.ts` |
| F22 | `AgentChatService.processMessage`가 LLMPort.chat → Observable<AgentSSEEvent> 를 그대로 stream subject로 흘림 | unit test (`agent-chat.service.test.ts`) 통과 |
| F23 | MCP 관련 파일/엔드포인트(`/agent/tool-result`, `/agent/tools/execute`, `mcp-proxy.mjs`, `hypurrquant-mcp-server.ts`)가 **존재하지 않음** | `find apps/server -name "mcp-proxy*" -o -name "hypurrquant-mcp-server*"` 결과 0 + `grep -rn "tool-result\|/tools/execute" apps/server/src` 결과 0 |

### Intent 파싱 (Anthropic 제거 + Codex 경유)

| # | 조건 | 검증 방법 |
|---|------|----------|
| F24 | `IntentService.parse(text, chainId)`가 `AgentLLMPort.chat()`을 통해 codex 호출, JSON 응답 누적 → ParsedIntentSchema.parse | unit test 모킹 LLMPort 통과 |
| F25 | acpx 호출 실패 / JSON 파싱 실패 시 `parseIntentHeuristic` fallback 실행 | unit test (mock spawn ENOENT) 통과 |
| F26 | 루트 package.json 및 apps/* package.json 에서 `@anthropic-ai/sdk`, `@langchain/anthropic` 의존성 제거 | `grep -r "@anthropic-ai\|@langchain/anthropic" --include=package.json . \| wc -l` → 0 |
| F27 | 어디에서도 `ANTHROPIC_API_KEY` 참조 없음 (테스트 fixture 제외, 단 src/는 면제) | `grep -rn "ANTHROPIC_API_KEY" apps/` → 0 |

### apps/web (Next.js)

| # | 조건 | 검증 방법 |
|---|------|----------|
| F28 | `apps/web` 안에 `app/api/` 디렉토리 **없음** (Next.js API Route 미사용) | `find apps/web/src/app/api -type f 2>/dev/null \| wc -l` → 0 |
| F29 | `next build` 성공 | `pnpm --filter @seabw/web build` exit 0 |
| F30 | `next dev` 부팅 시 3000 포트 listen + `/` 로딩 200 | `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/` → 200 |
| F31 | 모든 클라이언트 → 서버 호출이 `@seabw/web/lib/http.ts` 의 `http<T>()` 헬퍼로 통합 + base URL = `NEXT_PUBLIC_API_BASE_URL` | `grep -rn "fetch(" apps/web/src/{components,app} \| grep -v "lib/http" \| wc -l` → 0 (정적 자원 제외) |
| F32 | http 응답 타입 T 가 core DTO 타입으로 지정됨 (loose `any`/`unknown` 금지) | `grep -rn "http<" apps/web/src \| grep -E "http<(any\|unknown)>" \| wc -l` → 0 |
| F33 | 기존 페이지(/portfolio, /risks, /)가 새 server 호출 경로로 정상 렌더 | 수동: 두 서버 dev 부팅 후 브라우저 골든 패스 확인 |

## 비기능 완료 조건

| # | 조건 | 검증 방법 |
|---|------|----------|
| N1 | 모든 워크스페이스 TypeScript strict 통과 | `pnpm -r exec tsc --noEmit` exit 0 |
| N2 | server vitest/jest 테스트 전부 통과 (기존 25개 이전분 + 신규) | `pnpm --filter @seabw/server test` exit 0 |
| N3 | core 테스트 통과 | `pnpm --filter @seabw/core test` exit 0 |
| N4 | server 빌드 성공 | `pnpm --filter @seabw/server build` |
| N5 | web 빌드 성공 | `pnpm --filter @seabw/web build` |
| N6 | 루트에서 `pnpm install` 한 번으로 모든 의존성 설치 | `rm -rf node_modules apps/*/node_modules && pnpm install` exit 0 |
| N7 | core는 web/server 양쪽에서 동일 버전 import (`workspace:*` 사용) | `grep "@seabw/core" apps/server/package.json apps/web/package.json` 둘 다 `workspace:*` |
| N8 | web → server 소스 직접 import 금지 (HTTP만) | `grep -rn "from ['\"]@seabw/server" apps/web/src \| wc -l` → 0 |
| N9 | server → web 소스 import 금지 | `grep -rn "from ['\"]@seabw/web" apps/server/src \| wc -l` → 0 |
| N10 | src/ 보존 (수정 0건) | `git diff --stat src/` 결과 비어있음 |
| N11 | PROGRESS.md, README.md, design.md, dod.md, micro/*.md 가 docs/phases/v1.0.0-monorepo-codex 에 존재 | `ls docs/phases/v1.0.0-monorepo-codex/` |

## 엣지케이스

| # | 시나리오 | 기대 동작 | 검증 방법 |
|---|---------|----------|----------|
| E1 | acpx 바이너리 PATH에 없음 | `AgentLLMPort.chat()`이 `error` SSE 이벤트 송출 + done으로 종료, server crash 없음. IntentService는 휴리스틱 fallback. | unit test: child_process mock 으로 ENOENT 발생시키고 결과 검증 |
| E2 | acpx 응답이 비-JSON 텍스트 | IntentService가 JSON 추출 실패 → 휴리스틱 fallback | unit test |
| E3 | client가 unknown sessionId로 /agent/chat | 새 session 자동 생성 후 진행 | unit/integration test |
| E4 | POST /api/plan body 가 ZodSchema 위반 | 400 + `{ ok: false, error: { code: 'BAD_REQUEST', ... } }` | supertest |
| E5 | composer가 화이트리스트 0개 체인 → throw | controller가 잡아서 400 또는 422 + 메시지 반환 (기존 동작 보존) | supertest |
| E6 | 기존 src/의 vitest 시도 시 영향 없음 | 루트 `pnpm test`는 src/ 테스트를 실행하지 않음 (vitest config가 apps/*만 본다) | `pnpm test` 출력에서 src/ 경로 미포함 |
| E7 | 동일 sessionId 동시 요청 두 개 | message-queue가 FIFO로 직렬화 | unit test |
| E8 | LLM 호출 중 client가 connection abort | child process kill + sse subject complete | manual: `curl --max-time 1` |
| E9 | precheck에서 sanctioned address | 기존 동작 동일 (`{ ok: false, reason: 'sanctioned' }`) | supertest |
| E10 | defi-cli 미설치 + DEFIPILOT_ENV=prod | 기존과 동일하게 plan 생성 시 `agent.dry-run.mandatory` throw | unit test |

## PRD 목표 ↔ DoD 커버리지

| PRD 목표 | DoD 항목 | 커버 |
|----------|---------|------|
| (1) 모노레포 전환 | F1-F4, N6, N7 | ✅ |
| (2) Codex agent 이식 (chat-only) | F17-F23, F13 | ✅ |
| (3) Anthropic SDK 제거 | F16, F24-F27 | ✅ |
| (4) API 경계 타입 SSOT | F5-F9, F14, F32 | ✅ |
| src/ 보존 | F4, N10 | ✅ |

## 설계 결정 ↔ DoD 반영

| 설계 결정 | DoD 항목 | 커버 |
|----------|---------|------|
| pnpm workspace | F1, F2, N6 | ✅ |
| NestJS 11 + SWC | F10 | ✅ |
| apps/core SSOT | F5-F9, N7 | ✅ |
| 6 controllers + SSE | F11-F13 | ✅ |
| Codex acpx adapter | F19 | ✅ |
| InMemorySessionAdapter | F20 | ✅ |
| DevStubAuthAdapter | F21 | ✅ |
| MCP 제외 | F23 | ✅ |
| IntentService via LLMPort | F24, F25 | ✅ |
| web fetch wrapper | F31, F32 | ✅ |
| src/ 휴면 보존 | F4, N10 | ✅ |

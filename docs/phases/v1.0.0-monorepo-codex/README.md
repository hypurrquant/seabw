# Monorepo 전환 + Codex Pipeline 도입 - v1.0.0

## 문제 정의

### 현상
- 현재 seabw는 단일 Next.js 15 앱(App Router) 형태로, 서버 로직(API Route 6개)과 UI가 동일 프로세스/번들에 결합되어 있다.
- `src/agent/intent.ts`가 Anthropic SDK(`@anthropic-ai/sdk`)를 직접 호출해 자연어 → JSON intent 변환을 수행한다. LLM 호출이 Next.js 서버 런타임에 박혀 있어 분리·관측·교체가 어렵다.
- 도메인 로직(`agent/`, `lib/`, `policy/`, `schemas/`, `types/`)이 Next.js 앱 내부에 있어 다른 워크스페이스(예: 향후 모바일·관리자 콘솔 등)에서 재사용하기 어렵고, API 경계 타입(요청/응답 DTO)이 서버 코드와 클라이언트 코드 양쪽에서 같은 정의를 직접 import하는 형태다 → 분리되면 drift 위험.

### 원인
- 프로젝트 초기엔 Next.js 단일 앱 스케일이 충분했지만, 이후 (1) DeFi 도메인 로직 증가 (2) LLM agent 도입 (3) 참조 프로젝트(HypurrQuant_FE)와의 패턴 정합성 요구가 커지면서 모놀리식 구조의 한계가 드러났다.
- Anthropic SDK 직접 사용은 빠른 프로토타이핑엔 좋았지만, 참조 프로젝트가 이미 `acpx` + `codex-acp`(Zed) 기반 대화형 agent 파이프라인을 NestJS DDD 레이어로 운영 중이라 정합성이 떨어진다.

### 영향
- **개발자**: 서버/웹 책임 분리 모호 → 변경 시 영향 범위 추정이 어렵고, 타입 drift로 인한 런타임 버그 가능성 상존.
- **운영**: LLM 키(`ANTHROPIC_API_KEY`)가 Next.js 서버에 묶여 있어 모델 교체·세션 유지·SSE 스트리밍 등 확장 비용이 큼.
- **재사용**: 도메인 코어(타입/스키마/화이트리스트/플랜 컴포저)를 다른 앱에서 재활용할 수 없음.
- **참조 프로젝트와의 일관성**: HypurrQuant_FE 사용자가 seabw로 컨텍스트 스위치 시 디렉토리 구조·패턴이 달라 인지 비용 증가.

### 목표
1. **모노레포 구조 전환**: 레포 루트를 pnpm workspace 모노레포로 전환하고, `apps/{server, web, core}` 3개 워크스페이스로 책임을 분리한다.
   - `apps/server` — NestJS 11 (참조 프로젝트와 동일 메이저), API Route 6개 전부 controller로 이식.
   - `apps/web` — 기존 Next.js UI. API 호출은 HTTP로 `apps/server`를 호출.
   - `apps/core` — `@seabw/core`. API 경계 타입(요청·응답 DTO, `ApiResponse<T>`) + 프레임워크 독립 도메인 타입(`PipelinePlan`, `ParsedIntent`, 스키마 등)을 server·web 양쪽에서 공유.
2. **Codex agent 도메인 이식**: HypurrQuant_FE `apps/server/src/domains/agent`의 대화 유지용 레이어(`AgentLLMPort` + `AcpxLLMAdapter`, session/auth port, SSE controller)를 가져와 NestJS 서버에 탑재한다. 단, **LLM이 pipeline ↔ atoms 변환을 수행하는 MCP tool 영역은 가져오지 않는다** — seabw의 plan composer는 결정론 로직을 유지하고, codex는 자연어 대화 + intent 파싱 용도로만 사용.
3. **Anthropic SDK 제거**: `src/agent/intent.ts`의 `parseIntentLlm` 경로를 codex agent로 교체. `@anthropic-ai/sdk` 의존성과 `ANTHROPIC_API_KEY` 직접 사용 코드 모두 제거.
4. **API 경계 타입 SSOT**: 참조 프로젝트의 `api-contract-server-binding` 패턴을 적용 — controller method의 return/body 타입을 `apps/core`의 공유 타입으로 강제하고, web 측 HTTP 클라이언트도 동일 타입을 소비.

### 비목표 (Out of Scope)
- **기존 `src/` 디렉토리 삭제**: 사용자 결정으로 `src/`는 그대로 유지(휴면 상태). cutover는 이번 phase에서 한 번에 진행하지만 백업/참조 목적의 보존.
- **LLM-driven plan composition**: codex가 MCP tool을 호출해 plan을 만드는 영역(HypurrQuant_FE의 pipeline-resolve domain 일부)은 이식 대상에서 제외. seabw의 `composePlan()`은 결정론 그대로.
- **DB/세션 영속화**: 참조 프로젝트는 Mongo로 agent session을 저장하지만, 이번 phase는 인메모리 또는 placeholder adapter로 충분. 영속화는 후속.
- **인증/Auth 강화**: `AgentAuthPort` 인터페이스는 가져오되 구체 구현은 dev stub. 실제 챌린지/검증은 후속.
- **e2e 테스트 풀 마이그레이션**: 기존 playwright 시나리오 중 routing/페이지 의존 부분만 baseURL/포트 조정. 새 SSE 시나리오 추가는 별도 phase.
- **landing/모바일 앱**: 참조 프로젝트엔 있지만 seabw에서는 `apps/{server,web,core}` 3개만 다룬다.
- **Docker/배포 인프라**: NestJS 로컬 dev/prod 빌드만. 컨테이너·CI/CD 파이프라인 변경은 별도.

## 제약사항

### 기술적 제약
- **Node**: ≥ 20 (참조 프로젝트와 동일). **pnpm**: ≥ 10.
- **NestJS 11** + **SWC** 빌더(`nest build`) — 참조 프로젝트와 정합.
- **Next.js 15** App Router 유지 (apps/web).
- **TypeScript strict** 유지, `apps/core` 노출은 `index.ts` SSOT 또는 `exports` 맵.
- **Codex 실행 환경**: `acpx` + `@zed-industries/codex-acp` 바이너리가 로컬에 존재한다고 가정. 미설치 시 adapter는 fast-fail + 휴리스틱 fallback 경로 보장(현재 `parseIntent`의 fallback과 동일 사상).
- **Tool tree 보전**: `defi-cli` 외부 바이너리 호출(`src/lib/defiCli.ts`)은 그대로 server 도메인으로 이관.

### 비즈니스 제약
- 기존 6개 API의 **외부 계약(URL path, request/response shape)** 은 변경하지 않는다 — 클라이언트 마이그레이션 비용 최소화. 단, base URL은 `same-origin /api/*` → `http://<server>:<port>/api/*` 로 변경 가능(개발 환경 proxy 설정 필요).
- `src/` 보존: phase 종료 후에도 삭제 금지.

### 시간 제약
- 단발 phase, 한 번에 진행 (점진적 dual-write 미사용).

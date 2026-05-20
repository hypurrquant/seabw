# 설계 - v1.1.0

## 변경 규모

**규모**: 서비스 경계 (Service Boundary)

**근거 (트리거)**:
- 외부 API 추가: `api.hypurrquant.com` (pool/position read) 신규 의존
- 외부 SDK/툴체인 도입: `@openai/codex` CLI + Codex MCP stdio 프로토콜
- 신규 인증/실행 경계: server ↔ codex CLI ↔ MCP tool 세 노드 간 계약
- 데이터 모델 변경: `PoolDTO`/`RecipeAtom`/`StepContext` 신규, `SharedState` 세션 스키마
- API 변경: NestJS 신규 5엔드포인트(`/pipeline/*` 4개 + `/agent/tools/execute`), 기존 도메인 시그니처 수정 (PoolDTO 채택)
- 코드 베이스 광역 변경: `@hq/*` → `@seabw/*` 네임스페이스 리브랜드, defi-cli 완전 제거
- 운영 리스크: wasm-crypto plaintext stub (의도적 hackathon scope)

자동 승격 규칙(API 변경 + 외부 의존 + 데이터 스키마 변경) 모두에 해당하여 최고 등급으로 분류.

---

## 문제 요약

v1.0.0은 모노레포/Codex 채택까지만 끝났고, LP 데이터 read 경로는 여전히 `defi-cli` 자식 프로세스에 묶여 있어 dynamic AI 쿼리·LP write·온체인 multi-step 실행 자동화가 불가능하다. v1.1.0은 HypurrQuant FE의 LP 스택(read+write+pipeline+MCP)을 1회성 vendor copy로 이식해 `defi-cli`를 완전히 제거하고, Codex가 server를 통해 LP를 조회·구성·실행하도록 만든다.

> 상세 문제 정의 및 PRD: [./README.md](./README.md)

---

## 접근법

핵심 전략: **"Vendor copy + 완전 컷오버 + 도메인 경계 재정의"**.

1. HQ FE에서 LP 한정 패키지/도메인을 **순수 라이브러리 단위로 복사**한다 (`packages/core/defi/{lp,routing,pipeline}`, `packages/react/defi/lp/**`, server `domains/pipeline-resolve`, `tools/hypurrquant-mcp-server.ts`).
2. import 경로 일괄 변환(`@hq/*` → `@seabw/*`). `@hq/wasm-crypto`는 base64 plaintext stub로 대체.
3. defi-cli 관련 자산(`apps/server/src/lib/defi-cli.ts`, agent tools allowlist의 `defi.*` 항목, 환경변수 `DEFI_CLI_*`)을 **단일 컷오버 PR로 삭제**한다. 동시 운영(dual-write/2개 backend) 단계를 두지 않는다.
4. AI write/실행 경로는 NestJS의 `pipeline-resolve` 도메인 패턴을 그대로 포팅한다. Codex는 MCP 툴을 통해 `/pipeline/resolve` → `/pipeline/build-step` ↔ wagmi 서명 ↔ `/pipeline/step-complete` 루프를 진행한다.
5. AI read는 free-form zod 술어를 받는 dynamic query MCP 툴 `lp.pools.query`로 단일화. 결과는 byte/row 캡으로 truncate한다.
6. Survey 결과 → prompt 변환만 신규(이미 존재하는 Survey UI를 재사용). 그 외 web 변경은 LP 화면 hook 재배선에 한정.

설계의 일관된 축: **"서버는 stateless executor가 아니라 'session-aware orchestrator'"**, **"client는 signer + UI"**, **"codex는 planner + tool caller"**. 이 3노드 책임 분리가 모든 컴포넌트 경계의 1차 기준이 된다.

---

## 대안 검토

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| A. defi-cli 유지 + HQ를 2nd backend로 병행 | 롤백 안전, 점진 마이그레이션, 회귀 위험 분산 | 두 LP 모델(defi-cli 출력 vs PoolDTO) 영구 어댑팅 코드 필요, Codex tool surface가 2배, 실제 컷오버 시점 끝없이 미뤄짐 | ❌ |
| B. **Vendor copy + 완전 컷오버** | 단일 도메인 모델(PoolDTO), Codex tool 단일화, defi-cli 환경/바이너리 의존 제거, hackathon 일정에 부합 | 1회 대규모 커밋, 회귀 가능성, HQ 업스트림 분기와 영구 분리 | ✅ |
| C. Git submodule로 HQ 참조 | 업스트림 추적 가능, 코드 중복 없음 | submodule + pnpm workspace + 다른 빌드 시스템 충돌, HQ의 React/Next 의존이 server까지 전염, 네임스페이스 리브랜드 불가 | ❌ |
| D. HQ 전체 fork 후 seabw를 거기 위에서 재구축 | 모든 기능 즉시 활용 | seabw의 도메인 모델(agent/plan/marketplace/survey) 통째 재이식 필요, scope 폭증 | ❌ |
| E. defi-cli를 서버 내 라이브러리로 흡수 + write는 직접 viem | 외부 프로세스 제거, write 자유도 | LP write/recipe/executor 전체 신규 작성, 검증 시간 부족, 결국 HQ를 재발명 | ❌ |

**선택 이유 (B)**: hackathon 일정 + "AI가 LP를 자율 실행" 데모 요구 + defi-cli 제거가 v1.1.0의 **목표 자체**라는 점에서, dual-write로 시간을 분산할 여유가 없다. C/D는 빌드/도메인 모델 충돌로 도입 비용이 본 phase scope를 초과한다. A는 defi-cli 제거 목표와 충돌한다.

---

## 기술 결정

- **언어/런타임**: 그대로 (Node 20, TS 5.x, pnpm workspace).
- **외부 데이터**: `api.hypurrquant.com` REST를 server에서만 호출(브라우저에서 직접 호출 금지 — CORS/레이트 한정). web의 LP read는 server proxy 경유.
- **HTTP 클라이언트**: HQ의 `packages/core/lib/http.ts`를 그대로 채택. seabw `@seabw/core/http`(API DTO 정의용)와 분리해 라이브러리 레이어로 둔다.
- **온체인 RPC**: viem ≥ 2.48. `packages/core/lib/viem-client.ts`, `rpc/provider.ts` 그대로 채택. RPC URL은 `SEABW_RPC_URL_<CHAIN>` env profile로 주입.
- **상태 관리(web)**: HQ의 zustand store + react hooks 그대로 채택. Next.js 15 클라이언트 컴포넌트 한정 사용.
- **서명(web)**: 기존 wagmi 유지. `/pipeline/build-step` 응답 calldata를 `useSendTransaction`/`writeContract`에 전달.
- **AI agent**: codex CLI(acpx + codex-acp) 그대로 사용. seabw가 LP MCP tool을 stdio로 제공.
- **MCP 등록**: 서버 부팅 시 `codex mcp add` 명령으로 1회 등록(또는 codex config에 정적 등록). MCP server는 NestJS와 **별 프로세스**로 실행되며, localhost HTTP로 NestJS의 `/agent/tools/execute`를 호출.
- **crypto stub**: `@seabw/wasm-crypto`는 인터페이스만 유지하고 내부적으로 base64 encode/decode. 모든 호출 지점은 grep 가능한 단일 함수명 사용. README + 코드에 "DO NOT USE IN PRODUCTION" 명시.
- **세션 저장**: in-memory `Map<sessionId, SharedState>`, TTL 30분, 최대 100세션. Redis/DB 미사용.
- **MCP transport**: stdio (Codex CLI 표준).

---

## 범위 / 비범위

### 범위 (In Scope)

- HQ FE → seabw 로 LP 한정 vendor copy
  - `packages/core/defi/{lp,routing,pipeline}` 전부
  - `packages/core/lib/{http,viem-client}`, `packages/core/rpc/provider`
  - `packages/react/defi/lp/{pool,position}/{hooks,stores}`
  - `apps/server/src/domains/pipeline-resolve/**`
  - `apps/server/tools/hypurrquant-mcp-server.ts`
- `@hq/*` → `@seabw/*` 네임스페이스 리브랜드 (codemod 1회)
- `@seabw/wasm-crypto` plaintext stub 패키지 신설
- defi-cli 완전 제거
  - `apps/server/src/lib/defi-cli.ts` 삭제
  - `apps/server/src/domains/agent/.../tools.ts` 의 `defi.*` allowlist 항목 삭제
  - env `DEFI_CLI_*`, `DEFIPILOT_*` 제거, README/compose에서도 제거
- 신규 server endpoints: `/pipeline/resolve`, `/pipeline/build-step`, `/pipeline/step-complete`, `/pipeline/calculate`, `/agent/tools/execute`
- 신규 MCP tools: `lp.pools.query`, `lp.position.list`, `lp.recipe.compose`, `pipeline.resolve`, `pipeline.buildStep`, `pipeline.stepComplete`
- 기존 도메인 시그니처 수정(PoolDTO 채택): `marketplace`, `plan`, `precheck`, `portfolio`, `agent`
- Survey 결과 → AI 프롬프트 변환 wiring (web)

### 비범위 (Out of Scope)

- lending, perp, 기타 swap-only 도메인 (HQ 코드에 존재하더라도 복사 대상 아님 — `defi/lp` + `defi/routing` 중 LP 의존부만)
- 실제 wasm crypto 구현
- HQ upstream 자동 sync 메커니즘
- 다중 체인 동시 지원 — v1.1.0은 HyperEVM 단일 체인 기준
- DB 영속 세션
- 다중 사용자 격리(단일 데모 세션 가정)

---

## 가정/제약

- **wasm-crypto는 base64 평문**. 모든 호출부는 인터페이스만 의존하므로 차후 실제 구현 교체 시 호출부 무수정.
- **codex CLI가 사용자 머신/서버에 설치**되어 있음. 부팅 시 `which codex` 체크, 없으면 fail-fast.
- **viem RPC URL은 .env 프로파일**: `SEABW_RPC_URL_HYPEREVM`. 없으면 default fallback URL.
- **HQ upstream은 v1.1.0 이후 별개 프로젝트로 간주**. cherry-pick 안 함.
- **HQ FE는 React 19 + Next.js 15 사용** 가정 — seabw web도 동일하므로 react hooks 호환.
- **HQ의 `packages/core/defi`는 React 의존 없음** — server에서도 import 가능 (조사로 검증됨).
- **Codex MCP는 stdio 전송만 사용** (SSE 미사용).
- **단일 사용자/단일 wallet 데모** 가정. concurrent session 보호는 in-memory cap만으로 충분.
- **API 응답 크기 cap**: 한 MCP tool 응답 ≤ 64KB (Codex context 폭주 방지).

---

## 아키텍처 개요

### 목표 디렉토리 트리 (변경 후)

```
seabw/
├─ apps/
│  ├─ core/                              # @seabw/core (기존, 유지)
│  ├─ server/                            # @seabw/server (NestJS 11)
│  │  ├─ src/
│  │  │  ├─ domains/
│  │  │  │  ├─ agent/                    # (수정) tools allowlist 갱신, MCP tool 핸들러 추가
│  │  │  │  ├─ plan/                     # (수정) PoolDTO 채택
│  │  │  │  ├─ marketplace/              # (수정) PoolDTO 채택
│  │  │  │  ├─ precheck/                 # (수정) PoolDTO 채택
│  │  │  │  ├─ portfolio/                # (수정) PoolDTO 채택
│  │  │  │  └─ pipeline/                 # (신규) HQ pipeline-resolve 포팅
│  │  │  │      ├─ pipeline.controller.ts
│  │  │  │      ├─ pipeline.module.ts
│  │  │  │      ├─ application/
│  │  │  │      ├─ atoms/
│  │  │  │      ├─ dto/
│  │  │  │      └─ session/              # (신규) in-memory SharedState store
│  │  │  └─ lib/
│  │  │     └─ defi-cli.ts               # (삭제)
│  │  └─ tools/
│  │     └─ seabw-mcp-server.ts          # (신규, HQ hypurrquant-mcp-server 포팅)
│  └─ web/                               # @seabw/web (Next.js 15)
│     └─ src/
│        ├─ app/...                      # (수정) hooks 재배선
│        └─ features/survey/             # (수정) result → prompt 변환
└─ packages/                             # (신규 워크스페이스 루트)
   ├─ defi/                              # @seabw/defi (HQ packages/core/defi 포팅)
   │  ├─ lp/{types,identity,capability,api,registry}.ts
   │  ├─ lp/{pool,position,recipe,mint,remove}/**
   │  ├─ routing/{atoms,swap,bridge}/**
   │  └─ pipeline/{executor,client,types,local-stages,stage-builder}.ts
   ├─ defi-react/                        # @seabw/defi-react (HQ packages/react/defi/lp 포팅)
   │  └─ lp/{pool,position}/{hooks,stores}
   ├─ defi-http/                         # @seabw/defi-http (HQ packages/core/lib + rpc)
   │  └─ {http,viem-client}.ts, rpc/provider.ts
   └─ wasm-crypto/                       # @seabw/wasm-crypto (plaintext stub)
      └─ index.ts                        # base64 encode/decode
```

### 모듈 의존 그래프

```
                   ┌─────────────────────────────────────────┐
                   │ codex CLI (acpx + codex-acp)            │
                   └─────────────┬───────────────────────────┘
                                 │ stdio (MCP)
                   ┌─────────────▼───────────────────────────┐
                   │ apps/server/tools/seabw-mcp-server.ts   │
                   └─────────────┬───────────────────────────┘
                                 │ HTTP localhost
┌──────────────────────┐         │
│ apps/web (Next 15)   │─wagmi───┤
│  defi-react hooks    │         │
└──────────┬───────────┘         │
           │ fetch (server proxy)
           ▼                      ▼
   ┌────────────────────────────────────────┐
   │ apps/server (NestJS 11)                │
   │  domains/{agent,plan,marketplace,…}    │
   │  domains/pipeline/* ◄── 신규           │
   └─────────┬─────────────────┬────────────┘
             │                 │
             ▼                 ▼
   ┌────────────────┐  ┌────────────────────┐
   │ @seabw/defi    │  │ @seabw/defi-http   │
   │ (LP+routing+   │  │ (http+viem+rpc)    │
   │  pipeline)     │  │                    │
   └───────┬────────┘  └─────────┬──────────┘
           │                     │
           ▼                     ▼
   ┌────────────────┐    ┌──────────────────────┐
   │ @seabw/wasm-   │    │ api.hypurrquant.com  │
   │ crypto (stub)  │    │ (외부 read)          │
   └────────────────┘    └──────────────────────┘
```

- `@seabw/defi`는 React 비의존(server·web 양쪽에서 import 가능)
- `@seabw/defi-react`는 web 전용
- `@seabw/defi-http`는 server/web 양쪽에서 사용하나 RPC provider 인스턴스화는 caller 책임

---

## 데이터 흐름

### Flow 1 — 일반 LP read (web hook → server → api.hypurrquant.com)

```
[web] <PoolList/> 마운트
  └→ usePoolsQuery() (@seabw/defi-react)
      └→ fetch('/api/marketplace/pools')
          └→ NestJS MarketplaceController
              └→ @seabw/defi/lp/api.ts → @seabw/defi-http/http.ts
                  └→ GET api.hypurrquant.com/v1/pools?chain=hyperevm
                      └→ PoolDTO[] (zod parse)
                  └→ zustand store hydrate (web)
                      └→ <PoolList/> render
```

- 캐싱: react-query staleTime 30s + server in-memory LRU 30s.
- CORS 회피: web은 항상 same-origin `/api/*`로만 통신.

### Flow 2 — AI dynamic query (codex → MCP → server → HQ API → truncate)

```
[user] "USDC-HYPE 풀 중 TVL 1M 이상인 거 보여줘"
  └→ codex (chat)
      └→ tool call: lp.pools.query {
           predicateExpr: "p => p.tokenA.symbol==='USDC' && p.tvlUsd > 1_000_000",
           limit: 20, sort: {by:'tvlUsd', dir:'desc'}
         }
          └→ MCP server (seabw-mcp-server, stdio)
              └→ HTTP POST localhost:3000/agent/tools/execute
                  └→ NestJS AgentToolsController
                      └→ PipelineToolService.runPoolsQuery()
                          └→ @seabw/defi/lp/api.getPools(chain)  → api.hypurrquant.com
                              └→ PoolDTO[] (~수백 개)
                          └→ filter(predicateFn) + sort + slice(limit)
                          └→ truncate(maxBytes=64KB)
                          └→ {pools: PoolDTO[], truncated: bool, totalBefore: number}
                  └→ HTTP 200 JSON
              └→ MCP tool result (stringified)
          └→ codex 응답 생성
```

- predicate는 zod로 syntax/길이 검증 후 `new Function('p', 'return (' + expr + ')(p)')`로 평가. timeout 200ms.
- truncate 우선순위: `sort` 기준 상위 N → JSON.stringify → byte cap 초과 시 1개씩 drop.

### Flow 3 — LP execution (codex → recipe → /resolve → build/sign/complete 루프)

```
[user] "USDC-HYPE 100 USDC mint 해줘"
  └→ codex
      ├─ tool: lp.recipe.compose {action:'mint', poolId, amountIn} → RecipeAtom[]
      ├─ tool: pipeline.resolve {recipe, userAddress, chain}
      │   └→ POST /pipeline/resolve
      │       └→ executor.plan(recipe) → StepContext{sessionId, steps:[Step], sharedState}
      │       └→ {sessionId, totalSteps, firstStep: Step}
      └─ loop until done:
          ├─ tool: pipeline.buildStep {sessionId, stepIndex}
          │   └→ POST /pipeline/build-step → {to, data, value, chainId, gasHint}
          │   └→ codex → web에 "서명 요청" UI/message 트리거
          │       └→ web wagmi: useSendTransaction({to,data,value}).sendTransaction()
          │           └→ user wallet 서명 → 체인 broadcast → txHash
          ├─ tool: pipeline.stepComplete {sessionId, stepIndex, txHash, receiptStatus}
          │   └→ POST /pipeline/step-complete
          │       └→ executor.advance(): sharedState 업데이트, 다음 step 결정
          │       └→ {done: false, nextStep} 또는 {done: true, result}
          └─ done=true 시 codex 최종 요약 메시지 생성
```

- step 사이에서 server는 sharedState(이전 step의 receipt logs, deadline, minOut 등)를 유지하므로 codex는 stateless 호출만 하면 됨.
- 시그너 거절/타임아웃: codex가 `pipeline.stepComplete` 대신 사용자 메시지로 abort. server는 TTL로 세션 정리.

---

## API/인터페이스 계약

### 신규 server endpoints (`apps/server/src/domains/pipeline`)

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/pipeline/resolve` | `{recipe: RecipeAtom[], userAddress: 0xstring, chainId: number}` | `{sessionId: string, totalSteps: number, firstStep: Step}` |
| POST | `/pipeline/build-step` | `{sessionId, stepIndex}` | `{to, data, value, chainId, gasHint}` |
| POST | `/pipeline/step-complete` | `{sessionId, stepIndex, txHash, receiptStatus: 'success'\|'reverted'}` | `{done: boolean, nextStep?: Step, result?: unknown}` |
| POST | `/pipeline/calculate` | `{recipe, userAddress, chainId}` | `{expectedOut, priceImpact, route}` (dry-run) |
| POST | `/agent/tools/execute` | `{tool: string, args: Json}` | `{ok: true, data: Json} \| {ok: false, error: string}` |

### 신규 MCP tools (`apps/server/tools/seabw-mcp-server.ts`)

| Tool | 입력 zod | 출력 zod |
|------|----------|----------|
| `lp.pools.query` | `{predicateExpr: string, limit?: number, sort?: {by: string, dir: 'asc'\|'desc'}}` | `{pools: PoolDTO[], truncated: bool, totalBefore: number}` |
| `lp.position.list` | `{userAddress: HexAddress}` | `{positions: PositionDTO[]}` |
| `lp.recipe.compose` | `{action: 'mint'\|'remove'\|'collect', params: object}` | `{recipe: RecipeAtom[]}` |
| `pipeline.resolve` | (same as endpoint) | (same) |
| `pipeline.buildStep` | (same) | (same) |
| `pipeline.stepComplete` | (same) | (same) |

### 기존 도메인 시그니처 수정

- `marketplace`, `plan`, `precheck`, `portfolio`: 응답 풀/포지션 표현을 `PoolDTO`/`PositionDTO`로 통일
- `agent/tools.ts` allowlist: `defi.*` 13개 항목 제거 → 위 MCP tool 6개로 대체
- 외부 URL/메서드는 보존 (PRD 제약)

---

## 데이터 모델/스키마

### PoolDTO (HQ `packages/core/defi/lp/types.ts` 기반)

```ts
const PoolDTO = z.object({
  id: PoolIdentity,                     // {chainId, dex, address}
  dex: z.enum(['hyperswap', 'kittenswap', 'ramses', 'hybra', 'project-x', 'nest']),
  tokenA: TokenInfo, tokenB: TokenInfo,
  fee: z.number(), tickSpacing: z.number().optional(),
  tvlUsd: z.number(), volume24hUsd: z.number(),
  feesApr: z.number().optional(),
  liquidity: z.string(),                 // bigint as string
  sqrtPriceX96: z.string().optional(),
  updatedAt: z.string().datetime(),
});
```

### RecipeAtom

```ts
const RecipeAtom = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('approve'), token: HexAddress, spender: HexAddress, amount: z.string()}),
  z.object({kind: z.literal('mint'), pool: PoolIdentity, tickLower: z.number(), tickUpper: z.number(), amountA: z.string(), amountB: z.string()}),
  z.object({kind: z.literal('removeLiquidity'), positionId: z.string(), liquidity: z.string()}),
  z.object({kind: z.literal('collect'), positionId: z.string()}),
  z.object({kind: z.literal('swap'), route: SwapRoute, amountIn: z.string(), minOut: z.string()}),
]);
```

### SharedState (server 세션)

```ts
const SharedState = z.object({
  sessionId: z.string().uuid(),
  userAddress: HexAddress,
  chainId: z.number(),
  recipe: z.array(RecipeAtom),
  steps: z.array(Step),                  // executor.plan() 결과
  cursor: z.number(),                    // 현재 stepIndex
  history: z.array(z.object({
    stepIndex: z.number(),
    txHash: HexHash.optional(),
    receiptStatus: z.string().optional(),
    sideEffects: z.record(z.unknown()),  // logs/balances/etc
  })),
  createdAt: z.number(), expiresAt: z.number(),
});
```

세션 store: `Map<sessionId, SharedState>`, TTL 30분, 100개 cap, LRU eviction.

### MCP tool input/output

zod로 정의 후 `zodToJsonSchema()`로 MCP `inputSchema`로 변환. 출력은 `content: [{type:'text', text: JSON.stringify(result)}]`.

---

## 테스트 전략

- **unit (vitest)**
  - `@seabw/defi/lp/api.ts`: HQ에서 가져온 테스트 그대로 사용
  - `@seabw/defi/pipeline/executor.ts`: plan/advance 단위 케이스 (HQ `__tests__` 이식)
  - server `PipelineToolService.runPoolsQuery()`: predicate 평가, truncate, timeout
- **integration**
  - `/pipeline/resolve` → `/pipeline/build-step` → `/pipeline/step-complete` 시나리오(Nest TestingModule + 모킹된 viem provider)
  - MCP server → HTTP server end-to-end (stdio mock client)
- **smoke (hackathon)**
  - web: PoolList, PositionList, mint 모달 → wagmi 모킹 시그너로 sign → success toast
  - codex: "테스트 풀에서 1 USDC mint" 시나리오 1회 (사전 녹화 또는 수동)
- **명시적 미커버**: 멀티 사용자 동시성, 세션 TTL 만료, RPC fallback, predicate 악성 코드 격리

---

## 실패/에러 처리

| 시나리오 | 감지 지점 | 처리 |
|---------|----------|------|
| codex CLI 미설치 | 서버 부팅 `which codex` | fail-fast, README로 안내 |
| MCP tool timeout (>10s) | MCP wrapper | `{ok:false, error:'TIMEOUT'}`, codex 재시도 또는 사용자에게 보고 |
| `lp.pools.query` predicate throw | server eval try/catch | 400 + `{error:'PREDICATE_EVAL', message}` |
| stale quote (calculate 후 buildStep까지 N초 경과) | server `SharedState.expiresAt` | 410 Gone → codex가 `pipeline.resolve` 재호출 |
| signer rejection | wagmi try/catch | web이 codex에게 "사용자가 서명 거부" 메시지, server `/step-complete` 호출 없이 TTL 만료 |
| step revert (`receiptStatus: 'reverted'`) | `/step-complete` 수신 | `{done:true, result:{status:'reverted', stepIndex}}`, sharedState frozen |
| api.hypurrquant.com 5xx | `@seabw/defi/lp/api.ts` interceptor | 1회 retry, 실패 시 throw → tool 응답 `{ok:false}` |
| RPC provider 연결 실패 | viem-client | 부팅 시 ping 실패하면 fail-fast |

세션 정리: cron(1분) — 만료 세션 제거.

---

## 롤아웃/롤백 계획

- **롤아웃**: 단일 cutover. stack PR 3개 권장 — (1) vendor copy + rebrand, (2) pipeline 도메인 + MCP server 추가, (3) defi-cli 삭제 + endpoint 수정. 모두 main에 merge 후 즉시 dev/staging 배포. 사용자 영향: 단일 사용자(데모) 환경이므로 점진 출시 불필요.
- **단계 시퀀스**
  1. `packages/{defi,defi-react,defi-http,wasm-crypto}` 생성 + HQ 코드 복사 + 네임스페이스 codemod (build green 확인, 사용처 없음)
  2. `apps/server/src/domains/pipeline/**` 추가 + `tools/seabw-mcp-server.ts` 추가
  3. 기존 도메인을 PoolDTO로 마이그레이션 + 신규 endpoint 등록
  4. defi-cli 삭제 + agent tools allowlist 갱신 + env 제거
  5. web hooks 재배선 + survey wiring
- **롤백**: merge revert. defi-cli 삭제 커밋과 신규 도메인 커밋이 분리되어 있으면 부분 revert 가능. v1.0.x 태그가 남아있으므로 deployment를 이전 태그로 redeploy.
- **데이터 마이그레이션**: 없음(stateless, in-memory 세션).

---

## 관측성

- **server logs (pino)**
  - 모든 `/pipeline/*` 호출에 `sessionId` MDC 자동 부여
  - `tool=<name>` 필드로 MCP 호출 trace 분리
- **세션 inspector**: dev profile only — `GET /pipeline/sessions/:id`로 현재 SharedState JSON 덤프 (인증 없이, prod 비활성)
- **metric (smoke 수준)**
  - `pipeline.resolve.count`, `pipeline.step.completed`, `pipeline.step.reverted`, `mcp.tool.<name>.duration_ms`
  - stdout log + 콘솔; prometheus는 v1.2.0 이후
- **codex side**: codex CLI가 출력하는 tool call 로그를 그대로 사용

---

## 보안/권한

- **user-custody**: 모든 서명은 web wagmi. server는 private key 미보유. `/pipeline/build-step`은 calldata만 반환.
- **wasm-crypto stub 경계**: 데모 한정. README + 코드 주석에 "DO NOT USE IN PRODUCTION" 명시. 모든 encrypt 호출 지점은 grep 가능한 단일 함수명 사용.
- **MCP authn**: codex ↔ MCP server는 stdio (로컬 프로세스 신뢰). MCP server → NestJS는 localhost HTTP + dev/demo 무인증. 운영 가정 시 token 헤더 추가(공개 인터페이스로 노출 안 함).
- **predicate eval 격리**: `new Function('p', 'return (' + expr + ')(p)')` 형태로 sandbox 없이 실행. server는 인터넷에 노출 안 됨(로컬 데모). 운영 노출 시 vm2/isolated-vm 도입 — v1.1.0에선 의도적 제외.
- **CORS**: `/pipeline/*`는 web origin만 허용. `/agent/tools/execute`는 localhost만 허용(MCP server 호출용).
- **env secret**: RPC URL, api.hypurrquant.com key는 .env (server 전용). web에는 노출 X.

---

## 성능/스케일

- **MCP 응답 cap**: 64KB. `lp.pools.query`는 sort 기준 상위 N(기본 20) → JSON.stringify byte check → 초과 시 1개씩 drop until ≤cap. `truncated:true`와 `totalBefore` 항상 반환.
- **세션 cap**: in-memory 100, LRU. 초과 시 가장 오래된 세션 evict.
- **executor multicall batching**: HQ executor가 이미 multicall 지원(approve+mint 묶기 등). 그대로 활용.
- **api.hypurrquant.com cache**: server in-memory LRU (`packages/defi/lp/registry.ts` 캐시 그대로). TTL 30s.
- **viem provider 재사용**: 프로세스당 singleton.
- **codex context 보호**: 큰 객체(receipt logs 등)는 `summarize: true` 옵션으로 요약 모드 제공.

---

## 리스크/오픈 이슈

- **R1. HQ upstream divergence**: vendor copy 이후 HQ 본가가 LP 모델을 바꾸면 seabw는 영구 분리. 차기 LP DEX 추가 시 수동 포팅. **수용** — scope 외.
- **R2. viem 버전 드리프트**: HQ가 가정하는 viem 버전과 seabw 추후 업그레이드 충돌. **완화**: 패키지 버전 lock + dependabot off.
- **R3. MCP CLI install fragility**: codex CLI 미설치 시 데모 실패. **완화**: 부팅 체크 + README 설치 스크립트.
- **R4. plaintext crypto endpoint accidental leak**: 데모 endpoint가 public deploy 시 정보 노출. **완화**: dev profile gate + README warning + grep-able 함수명.
- **R5. predicate eval RCE**: 로컬 데모 한정이지만, server 외부 노출 시 즉시 RCE. **완화**: README에 "do not expose publicly" + v1.2.0 vm 샌드박스 백로그.
- **R6. session in-memory loss on restart**: 진행 중 LP 트랜잭션 세션이 재시작 시 사라짐. **수용** (hackathon).
- **R7. PoolDTO 마이그레이션 회귀**: 기존 도메인 사용처가 web 전반에 흩어져 있음. **완화**: TypeScript strict 컴파일 강제 + smoke test.
- **오픈 이슈 (Step 3/4에서 결정)**
  - O1. MCP server 별 프로세스 관리 방식(pm2? `pnpm dev:mcp` script?) — 가장 단순한 방안: `pnpm dev:mcp` 별도 script.
  - O2. `lp.recipe.compose`는 server-side helper인가 MCP tool인가 — 현재는 MCP tool. codex가 직접 atoms를 조립할 수 있다면 간소화 검토.
  - O3. Survey result → prompt 변환 포맷 — web에서 markdown 템플릿 사용 가정. Step 4 티켓에서 확정.

---

## 결론

v1.1.0은 단순 기능 추가가 아니라 **LP read/write backbone 교체**다. defi-cli 외부 프로세스 의존을 제거하고, HQ의 검증된 LP/pipeline 코드를 vendor-copy로 채택하며, Codex + MCP를 통한 AI 자율 실행 경로를 완성한다. 단일 cutover의 회귀 위험은 TypeScript strict 컴파일 + smoke test로 봉인하고, 운영 위험(R4/R5/R6)은 hackathon 컨텍스트로 명시적 수용한다. 후속 v1.2.0의 자연스러운 토픽은 (a) crypto 실제 구현, (b) predicate 샌드박스, (c) 세션 영속화, (d) lending/perp 도메인 이식이다.

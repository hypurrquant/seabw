# DoD (Definition of Done) - v1.1.0

> 본 문서는 [README.md](README.md)의 목표(G1~G4)와 [design.md](design.md)의 기술 결정을 모두 검증한다.
> 모든 항목은 예/아니오로 판단 가능하며 검증 방법이 명시된다.

## 기능 완료 조건

### G1: HQ LP 전 영역 vendor copy

| # | 조건 | 검증 방법 |
|---|------|----------|
| F1.1 | `packages/defi` 워크스페이스가 존재하고 `@seabw/defi`로 export됨 | `pnpm -F @seabw/defi exec pwd` 가 `packages/defi` 반환 |
| F1.2 | HQ `packages/core/defi/lp/**` 의 모든 파일이 `packages/defi/lp/**` 에 복사됨 (lending/perp 디렉토리 제외) | `diff -rq /Users/mousebook/Documents/side-project/HypurrQuant_FE/packages/core/defi/lp packages/defi/lp` 시 `@hq/` ↔ `@seabw/` import 차이만 존재 |
| F1.3 | HQ `packages/core/defi/{routing,pipeline}/**` 이 `packages/defi/{routing,pipeline}/**` 에 복사됨 | 동일한 `diff -rq` 검사 |
| F1.4 | HQ `packages/react/defi/lp/**` 이 `packages/defi-react/lp/**` 에 복사됨 | 동일 검사 |
| F1.5 | HQ `packages/core/lib/{http,viem-client}.ts` + `rpc/provider.ts` 가 `packages/defi-http/` 에 복사됨 | 파일 존재 확인 + import 경로 grep |
| F1.6 | `@seabw/wasm-crypto` 패키지가 base64 plaintext stub로 존재 | `import {encrypt, decrypt} from '@seabw/wasm-crypto'` 로 한 줄 e2e: `decrypt(encrypt('x')) === 'x'` |
| F1.7 | 모든 vendored 파일의 import 경로가 `@hq/` 미포함 | `rg "@hq/" packages/defi packages/defi-react packages/defi-http` → 0 hits |
| F1.8 | `pnpm -r build` 성공 (vendored 패키지 컴파일 OK) | `pnpm -r build` exit 0 |
| F1.9 | `pnpm -r test` 성공 (HQ에서 가져온 unit test 통과) | `pnpm -r test` exit 0 |

### G2: defi-cli 완전 폐기

| # | 조건 | 검증 방법 |
|---|------|----------|
| F2.1 | `apps/server/src/lib/defi-cli.ts` 파일이 삭제됨 | `[ ! -f apps/server/src/lib/defi-cli.ts ]` |
| F2.2 | 모든 소스 코드에서 `defi-cli` import / spawn 호출 없음 | `rg "defi-cli\|defiCli\|DefiCli\|spawn\(.*defi" apps src packages` → 0 hits |
| F2.3 | `agent` 도메인의 tool allowlist에서 `defi.*` 항목 모두 제거됨 | `rg "^\s*['\"]defi\." apps/server/src/domains/agent` → 0 hits |
| F2.4 | env 변수 `DEFI_CLI_*`, `DEFIPILOT_*` 가 코드/문서/.env.example에 등장하지 않음 | `rg "DEFI_CLI_\|DEFIPILOT_" apps src docs .env.example 2>/dev/null` → 0 hits |
| F2.5 | README/CLAUDE.md의 "defi-cli" 언급이 "HQ pipeline" / "@seabw/defi"로 갱신됨 | `rg "defi-cli" README.md CLAUDE.md` 시 v1.1.0 이전 페이즈 메모만 hit (또는 0 hits) |
| F2.6 | 기존 도메인(`marketplace`, `plan`, `precheck`, `portfolio`)이 PoolDTO/PositionDTO를 반환하도록 수정됨 | 각 도메인 controller의 response type이 `@seabw/defi/lp/types`에서 import됨을 grep으로 확인 |

### G3: NestJS pipeline 도메인 + MCP server

| # | 조건 | 검증 방법 |
|---|------|----------|
| F3.1 | `apps/server/src/domains/pipeline/` 디렉토리 존재 + PipelineModule 등록됨 | `rg "PipelineModule" apps/server/src/app.module.ts` |
| F3.2 | `POST /pipeline/resolve` 가 200 응답 + `{sessionId, totalSteps, firstStep}` 반환 | `curl -X POST localhost:4000/pipeline/resolve -d '{"recipe":[...mint...],"userAddress":"0xabc","chainId":999}'` → 200 + JSON shape 일치 |
| F3.3 | `POST /pipeline/build-step` 가 calldata `{to, data, value, chainId, gasHint}` 반환 | curl 동일, response shape grep |
| F3.4 | `POST /pipeline/step-complete` 가 `{done, nextStep?, result?}` 반환하고 sharedState를 advance함 | integration test: resolve → buildStep → stepComplete sequence가 next step을 반환 |
| F3.5 | `POST /pipeline/calculate` 가 dry-run 응답 `{expectedOut, priceImpact, route}` 반환 | curl + response shape grep |
| F3.6 | `POST /agent/tools/execute` 가 6개 MCP tool name을 dispatch할 수 있음 | unit test: `tool: 'lp.pools.query'` 호출 시 `PipelineToolService.runPoolsQuery` invoked |
| F3.7 | 세션 store가 in-memory `Map<sessionId, SharedState>` 이며 TTL 30분 만료 작동 | unit test: 시간 mock으로 expiresAt+1ms 후 `getSession()` → undefined |
| F3.8 | `apps/server/tools/seabw-mcp-server.ts` 가 존재하고 6개 tool을 stdio로 등록 | `node apps/server/tools/seabw-mcp-server.ts` 실행 + MCP `list_tools` 응답에 6개 tool 포함 |
| F3.9 | MCP server → `POST /agent/tools/execute` 호출 시 응답을 그대로 codex에 returns | smoke test: MCP CLI 모킹으로 tool 호출 → 응답 콘텐츠 검증 |

### G4: AI dynamic query + 실행 흐름

| # | 조건 | 검증 방법 |
|---|------|----------|
| F4.1 | `lp.pools.query` tool이 free-form zod predicate를 받아 결과를 truncate해서 반환 | unit test: predicate `p => p.tvlUsd > 1e6` + 200개 mock pool → ≤20개 반환 + `truncated`/`totalBefore` 포함 |
| F4.2 | predicate 평가 timeout (200ms) 시 에러 응답 | unit test: `predicateExpr: 'while(1){}'` → 400 + `error:'PREDICATE_EVAL'` 또는 timeout error |
| F4.3 | 응답 byte cap (64KB) 초과 시 1개씩 drop until ≤cap | unit test: 한 PoolDTO ~5KB × 20개 mock → 응답 ≤64KB, drop 발생 시 `truncated:true` |
| F4.4 | Survey 결과 → AI 시스템 프롬프트에 인젝션됨 | web 페이지에서 survey 완료 → chat 세션 시작 시 첫 messages payload에 tendency 텍스트 포함 (network tab 확인) |
| F4.5 | 시스템 프롬프트에 PoolDTO 스펙 (필드명·타입) 포함 | server agent.service 코드 grep: `PoolDTO` 필드명 nm 5개 이상 hit |
| F4.6 | codex → MCP tool 호출 → server → HQ API → 응답 → codex 1 round-trip이 데모 환경에서 작동 | 수동 smoke: codex chat에 "TVL 1M 이상 USDC 풀 보여줘" → tool call → 풀 목록 응답 |
| F4.7 | wagmi가 `/pipeline/build-step` 응답 calldata를 받아 서명 트랜잭션을 보낼 수 있음 | web e2e (mocked wallet): mint 모달 클릭 → wagmi `sendTransaction` 호출 + 인자가 build-step 응답과 일치 |

## 비기능 완료 조건

| # | 조건 | 검증 방법 |
|---|------|----------|
| N1 | TypeScript strict 에러 0 | `pnpm typecheck` exit 0 |
| N2 | 린트 통과 | `pnpm lint` exit 0 |
| N3 | 전 워크스페이스 빌드 성공 | `pnpm -r build` exit 0 |
| N4 | 전 테스트 통과 | `pnpm -r test` exit 0 |
| N5 | DoD verify script 통과 (PRD/design 핵심 grep) | `bash scripts/verify-dod.sh` exit 0 |
| N6 | v1.0.0이 도입한 `scripts/verify-dod.sh` 가 정상 동작 (또는 v1.1.0 항목 추가됨) | 위 N5와 동일 |
| N7 | `apps/web` Next.js dev 부팅 OK (포트 3000) | `pnpm dev:web` 후 `curl localhost:3000` 200 |
| N8 | `apps/server` NestJS dev 부팅 OK (포트 4000) | `pnpm dev:server` 후 `curl localhost:4000/health` 200 (없으면 /pipeline/health 추가) |
| N9 | codex CLI 미설치 시 server는 정상 부팅 + warning 로그 | `which codex` 가짜 PATH로 가린 후 부팅 → stdout에 `WARN codex CLI not found` 포함 |
| N10 | MCP server 단독 실행 가능 | `node apps/server/tools/seabw-mcp-server.ts` 가 stdio에서 list_tools 요청에 응답 |
| N11 | 의존성 lock(`pnpm-lock.yaml`) 변경 사항이 phase 범위와 일치 | `git diff pnpm-lock.yaml` 시 viem/wormhole/zustand/react-query 등만 추가/변경 |
| N12 | README/CLAUDE.md "현재 페이즈" 가 v1.1.0으로 갱신됨 | `head CLAUDE.md` 시 "v1.1.0" 표기 |

## 엣지케이스

| # | 시나리오 | 기대 동작 | 검증 방법 |
|---|---------|----------|----------|
| E1 | codex CLI 미설치 상태에서 web에서 chat 시도 | server는 `/agent/chat` SSE에 error event 반환, web은 "Codex 미설치" UX 표시 | manual: `PATH=/tmp pnpm dev:server` → web chat → error toast |
| E2 | `lp.pools.query` predicate가 syntax error | server 400 + `error:'PREDICATE_EVAL'` | unit test: `predicateExpr: '(]'` |
| E3 | `lp.pools.query` predicate 결과가 0개 | `{pools:[], truncated:false, totalBefore:N}` 반환 | unit test: `p => false` |
| E4 | api.hypurrquant.com 5xx 응답 | server 1회 retry 후 500 + `error:'UPSTREAM'`, MCP tool은 `{ok:false}` 반환 | integration test: nock으로 5xx 모킹 |
| E5 | `/pipeline/build-step` 호출 시 sessionId가 없거나 만료 | 410 Gone + `error:'SESSION_EXPIRED'` | unit test: 미존재 sessionId 호출 |
| E6 | `/pipeline/step-complete` 가 receiptStatus:'reverted' 수신 | `{done:true, result:{status:'reverted', stepIndex}}` 반환 + sharedState frozen | unit test |
| E7 | wagmi 서명 거절(user reject) | web이 codex에게 "사용자 서명 거부" 메시지 전송 + server `/step-complete` 미호출 + 세션 TTL 만료 | manual: mocked rejection |
| E8 | 동일 sessionId로 동시에 `/build-step` 2회 호출 | 첫 호출만 처리, 두 번째는 409 Conflict 또는 동일 응답 (race-safe) | unit test (Promise.all) |
| E9 | 100개 세션 초과 시 새 세션 생성 | LRU 정책으로 가장 오래된 세션 evict, 새 세션 정상 발급 | unit test: 101번째 resolve 호출 |
| E10 | MCP tool 응답 64KB 정확히 초과 | `truncated:true` + drop된 개수 만큼 pools.length 감소 | unit test: 정확히 64KB+1 mock |
| E11 | viem RPC 다운 시 `/pipeline/build-step` 호출 | 503 + `error:'RPC_UNAVAILABLE'` (gas estimate 실패) | unit test: mocked RPC error |
| E12 | 한 recipe에 approve+mint multicall이 들어있을 때 | executor가 multicall로 묶어 단일 step으로 반환 | integration test: recipe에 approve+mint atom → totalSteps:1 |

---

## PRD 목표 ↔ DoD 커버리지

| PRD 목표 | 관련 DoD 항목 | 커버 |
|----------|--------------|------|
| G1: HQ LP 전 영역 vendor copy | F1.1~F1.9 | ✅ |
| G2: defi-cli 폐기 | F2.1~F2.6 | ✅ |
| G3: AI dynamic query 경로 | F3.1~F3.9, F4.1~F4.6 | ✅ |
| G4: 유저 흐름 1-2-3 연결 | F4.4~F4.7, E7, E11 | ✅ |

## 설계 결정 ↔ DoD 반영

| 설계 결정 | DoD 반영 | 커버 |
|----------|---------|------|
| Vendor copy + rebrand (대안 B) | F1.1~F1.9 | ✅ |
| `packages/defi`, `defi-react`, `defi-http`, `wasm-crypto` 4개 신규 워크스페이스 | F1.1~F1.6 | ✅ |
| NestJS pipeline 도메인 신설 (`/pipeline/{resolve,build-step,step-complete,calculate}`) | F3.1~F3.5 | ✅ |
| MCP server 별 프로세스 + stdio | F3.8, F3.9, N10 | ✅ |
| `/agent/tools/execute` 6 tool dispatch | F3.6, F4.1~F4.3 | ✅ |
| Free-form zod predicate eval + truncate | F4.1~F4.3, E2, E3, E10 | ✅ |
| Session store in-memory + TTL 30분 + 100 cap LRU | F3.7, E5, E9 | ✅ |
| wasm-crypto plaintext stub | F1.6 | ✅ |
| user-custody 유지 (wagmi 서명) | F4.7, E7 | ✅ |
| Single cutover (dual-write 없음) | F2.1~F2.6, N3 | ✅ |
| codex CLI 미설치 시 fail-soft | N9, E1 | ✅ |

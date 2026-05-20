# Step 07: seabw-mcp-server + 6 MCP tools + /agent/tools/execute

## 메타데이터
- **난이도**: 🔴 어려움
- **롤백 가능**: ✅
- **선행 조건**: Step 06

---

## 1. 구현 내용

### A. `apps/server/tools/seabw-mcp-server.ts` 신설
- HQ `apps/server/tools/hypurrquant-mcp-server.ts` 를 베이스로 포팅
- MCP SDK(`@modelcontextprotocol/sdk`)를 stdio 전송으로 구동
- 부팅 시 환경변수 `SEABW_TOOL_API_URL` (기본 `http://localhost:4000`) 로 NestJS 호출

### B. 6개 MCP tool 등록 (zod 입력/출력)

| Tool | 입력 | 출력 | 내부 동작 |
|---|---|---|---|
| `lp.pools.query` | `{predicateExpr: string, limit?: number≤50, sort?: {by: string, dir: 'asc'\|'desc'}}` | `{pools: PoolDTO[], truncated: bool, totalBefore: number}` | POST `/agent/tools/execute` → `PipelineToolService.runPoolsQuery()` |
| `lp.position.list` | `{userAddress: HexAddress}` | `{positions: PositionDTO[]}` | POST `/agent/tools/execute` |
| `lp.recipe.compose` | `{action: 'mint'\|'remove'\|'collect', params: object}` | `{recipe: RecipeAtom[]}` | POST `/agent/tools/execute` → recipe builder |
| `pipeline.resolve` | (same as endpoint) | (same) | POST `/pipeline/resolve` |
| `pipeline.buildStep` | (same) | (same) | POST `/pipeline/build-step` |
| `pipeline.stepComplete` | (same) | (same) | POST `/pipeline/step-complete` |

- 모든 tool 입력 스키마는 zod → `zodToJsonSchema` 로 변환해 MCP `inputSchema`로 등록
- 출력은 `content: [{type:'text', text: JSON.stringify(result)}]`
- 호출 timeout 10s (실패 시 `{ok:false, error:'TIMEOUT'}`)

### C. NestJS `/agent/tools/execute` 엔드포인트
- 위치: `apps/server/src/domains/agent/interface/tools.controller.ts` (또는 신설)
- 입력: `{tool: string, args: Json}`
- dispatcher: tool 이름으로 해당 service 호출
  - `lp.pools.query` → `PipelineToolService.runPoolsQuery(args)`
  - `lp.position.list` → `LpPositionService.list(args.userAddress)`
  - `lp.recipe.compose` → `LpRecipeService.compose(args.action, args.params)`
  - `pipeline.*` → 기존 PipelineController 내부 서비스 재사용
- allowlist 검증: `assertToolAllowed(tool)` (v1.0.0의 패턴 유지, 단 `defi.*` 자리에 위 6개 등록)
- 응답: `{ok: true, data: Json} | {ok: false, error: string}`

### D. `PipelineToolService.runPoolsQuery()`
- 위치: `apps/server/src/domains/pipeline/application/pool-query.service.ts` (Step 06 도메인 내에 신규)
- 동작:
  1. predicateExpr 길이 ≤500 검증
  2. `new Function('p', 'return (' + expr + ')(p)')` 로 함수 생성 (try/catch SyntaxError → 400 PREDICATE_EVAL)
  3. `@seabw/defi/lp/api.getPools(chain)` 호출 (server-side cache 30s TTL)
  4. timeout 200ms 안에 filter + sort 실행 (worker_threads 또는 setTimeout race)
  5. slice(limit ?? 20)
  6. JSON.stringify byte size 측정 → 64KB 초과 시 1개씩 pop until ≤cap
  7. `{pools, truncated, totalBefore}` 반환

### E. codex CLI MCP 등록
- 부팅 시 또는 setup 스크립트에서 `codex mcp add seabw-tools --env "SEABW_TOOL_API_URL=http://localhost:4000" -- node apps/server/tools/seabw-mcp-server.ts` 1회 실행
- README에 수동 등록 명령 안내

### F. 시스템 프롬프트
- `apps/server/src/domains/agent/application/system-prompt.service.ts` (또는 기존 파일 수정)
- 다음 섹션 인젝션:
  - 투자자 tendency (web에서 전달, Step 10에서 wiring)
  - **PoolDTO 스펙** (필드명/타입 표) — `lp.pools.query` 사용 가이드
  - 6 MCP tool 사용법 한 줄 요약
  - "단위: LP는 APR, Lending은 APY" 메모 (Lending은 미사용이지만 향후 호환 위해 한 줄)

### 테스트
- unit:
  - `runPoolsQuery` — predicate 평가, timeout, truncate (DoD F4.1~F4.3 + E2/E3/E10)
  - `/agent/tools/execute` — 6 tool dispatch + 미등록 tool은 403
- integration:
  - MCP stdio mock → tool 호출 → 응답 JSON shape

## 2. 완료 조건
- [ ] `apps/server/tools/seabw-mcp-server.ts` 가 stdio MCP server로 부팅 (`node apps/server/tools/seabw-mcp-server.ts` → list_tools 응답에 6개 tool)
- [ ] `/agent/tools/execute` 가 6 tool 모두 dispatch (unit test)
- [ ] `runPoolsQuery` predicate timeout, truncate, syntax error 처리 (unit test)
- [ ] codex 미설치 환경에서도 MCP server 단독 부팅은 가능 (codex 없이 stdio 자체 동작)
- [ ] 시스템 프롬프트에 PoolDTO 필드명 5개 이상 포함 (`rg "tokenA\|tvlUsd\|tickSpacing\|fee\|sqrtPriceX96" apps/server/src/domains/agent`)
- [ ] DoD F3.6, F3.8, F3.9, F4.1~F4.3, F4.5 충족

## 3. 롤백 방법
- `git checkout HEAD -- apps/server/tools/ apps/server/src/domains/agent/interface/tools.controller.ts apps/server/src/domains/pipeline/application/pool-query.service.ts`
- `app.module.ts` 변경 사항 되돌리기

---

## Scope

### 신규 생성 파일
```
apps/server/tools/seabw-mcp-server.ts
apps/server/src/domains/agent/interface/tools.controller.ts
apps/server/src/domains/pipeline/application/pool-query.service.ts
apps/server/src/domains/pipeline/application/lp-position.service.ts     # lp.position.list 처리
apps/server/src/domains/pipeline/application/lp-recipe.service.ts        # lp.recipe.compose 처리
apps/server/src/domains/agent/application/system-prompt.service.ts       # 또는 기존 파일 수정
apps/server/src/domains/agent/application/tool-allowlist.ts              # 6 MCP tool name 상수
apps/server/src/domains/agent/__tests__/tools.controller.spec.ts
apps/server/src/domains/pipeline/__tests__/pool-query.service.spec.ts
```

### 수정 대상 파일
- `apps/server/src/domains/agent/agent.module.ts` — ToolsController + 신규 service provider 등록
- `apps/server/src/domains/agent/.../tools.ts` (v1.0.0의 allowlist 파일) — `defi.*` 항목 제거 + 위 6개로 대체 (실제 삭제는 Step 09에서)
- `apps/server/package.json` — `@modelcontextprotocol/sdk`, `zod-to-json-schema` 추가

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| @modelcontextprotocol/sdk | 신규 dep | MCP server 구동 |
| zod-to-json-schema | 신규 dep | zod → JSON Schema 변환 |
| @seabw/defi | workspace dep (전이) | recipe/executor/PoolDTO |
| @seabw/defi-http | workspace dep (전이) | getPools 호출 |

### Side Effect 위험
- 위험 1: `new Function()` eval은 server 외부 노출 시 즉시 RCE. 대응: README + 코드 주석에 "DO NOT EXPOSE PUBLICLY". v1.2.0에 vm 샌드박스 도입.
- 위험 2: MCP server가 NestJS와 별 프로세스이므로 import 그래프가 갈라짐. 대응: HTTP 클라이언트만 사용 (in-proc import 금지).
- 위험 3: predicate timeout 200ms를 단일 스레드에서 race로만 강제 시 무한 루프는 못 막음. 대응: Step 06에서 worker_threads 사용 가능성 검토. v1.1.0 데모는 race + 길이 제한으로 충분.
- 위험 4: codex CLI 부재 시 MCP 미등록. 대응: setup 스크립트가 `which codex` 체크 후 안내.

### 참고할 기존 패턴
- HQ `apps/server/tools/hypurrquant-mcp-server.ts` — MCP server 골격
- HQ `apps/server/src/domains/agent/interface/agent.controller.ts` — tools 인터페이스 패턴

---

## FP/FN 검증

### False Positive
| Scope 항목 | 근거 | 판정 |
|---|---|---|
| seabw-mcp-server.ts | MCP 본체 | ✅ |
| tools.controller.ts | `/agent/tools/execute` | ✅ |
| pool-query.service.ts | runPoolsQuery 핵심 로직 | ✅ |
| lp-position.service.ts | tool dispatcher 대상 | ✅ |
| lp-recipe.service.ts | tool dispatcher 대상 | ✅ |
| system-prompt.service.ts | PoolDTO 스펙 + tendency 인젝션 | ✅ |
| tool-allowlist.ts | 6 tool 상수 | ✅ |
| 2개 spec | 검증 | ✅ |

### False Negative
| 구현 내용 | Scope 포함 | 판정 |
|---|---|---|
| codex mcp add 등록 명령 | scripts/setup.sh 또는 README (구현 아님 → 문서) | OK (Step 11에서 문서화) |
| `defi.*` allowlist 제거 | (Step 09에서 일괄) | OK |
| @modelcontextprotocol/sdk 의존성 | package.json 수정 ✅ | OK |
| pipeline.* tool 3종 dispatcher | Step 06의 controller 재사용 — 본 step에서는 MCP wrapper만 추가 | OK |

### 검증 통과: ✅

---

→ 다음: [Step 08: 기존 도메인 PoolDTO 마이그레이션](step-08-domain-migration.md)

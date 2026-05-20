# 작업 티켓 - v1.1.0

## 전체 현황

| # | Step | 난이도 | 롤백 | Scope | FP/FN | 개발 | 완료일 |
|---|------|--------|------|-------|-------|------|--------|
| 01 | 워크스페이스 스캐폴딩 | 🟡 | ✅ | ✅ | ✅ | ⏳ | - |
| 02 | wasm-crypto stub 작성 | 🟢 | ✅ | ✅ | ✅ | ⏳ | - |
| 03 | @seabw/defi-http vendor copy | 🟡 | ✅ | ✅ | ✅ | ⏳ | - |
| 04 | @seabw/defi vendor copy (LP+routing+pipeline) | 🟠 | ✅ | ✅ | ✅ | ⏳ | - |
| 05 | @seabw/defi-react vendor copy (hooks+stores) | 🟡 | ✅ | ✅ | ✅ | ⏳ | - |
| 06 | NestJS pipeline 도메인 + 세션 store | 🔴 | ✅ | ✅ | ✅ | ⏳ | - |
| 07 | seabw-mcp-server + 6 MCP tools + /agent/tools/execute | 🔴 | ✅ | ✅ | ✅ | ⏳ | - |
| 08 | 기존 도메인 PoolDTO 마이그레이션 | 🟠 | ✅ | ✅ | ✅ | ⏳ | - |
| 09 | defi-cli 완전 폐기 | 🟠 | ✅ | ✅ | ✅ | ⏳ | - |
| 10 | web hooks 재배선 + survey wiring | 🟠 | ✅ | ✅ | ✅ | ⏳ | - |
| 11 | DoD verify + smoke + 문서 갱신 | 🟡 | ✅ | ✅ | ✅ | ⏳ | - |

## 의존성

```
01 ─┬─→ 02 ──→ 03 ──→ 04 ──→ 05 ─┐
    │                              ├─→ 06 ──→ 07 ──→ 08 ──→ 09 ──→ 10 ──→ 11
    └──────────────────────────────┘
```

- 01은 모두의 선행
- 02는 04/03이 import하므로 그 전에
- 03(http)은 04(defi 본체)가 import
- 04는 05(react), 06(server pipeline), 07(MCP)가 import
- 06은 07(MCP가 /agent/tools/execute를 호출)이 필요
- 08, 09는 04/06/07이 끝나야 의미 있음 (PoolDTO 채택 + defi-cli 자리 차지)
- 10은 05, 08이 끝나야 hook 재배선 가능
- 11은 마지막

## 커버리지 매트릭스

### PRD 목표 → 티켓

| PRD 목표 | 관련 티켓 | 커버 |
|----------|----------|------|
| G1: HQ LP vendor copy (read/write/pipeline/MCP) | 01, 02, 03, 04, 05, 06, 07 | ✅ |
| G2: defi-cli 완전 폐기 | 08, 09 | ✅ |
| G3: AI dynamic query 경로 | 06, 07 | ✅ |
| G4: 유저 흐름 1-2-3 연결 (survey → AI → 실행) | 10, 11 | ✅ |

### DoD → 티켓

| DoD 항목 | 관련 티켓 | 커버 |
|----------|----------|------|
| F1.1~F1.9 (vendor copy) | 01, 02, 03, 04, 05 | ✅ |
| F2.1~F2.6 (defi-cli purge) | 08, 09 | ✅ |
| F3.1~F3.9 (pipeline + MCP) | 06, 07 | ✅ |
| F4.1~F4.7 (AI dynamic + 실행) | 07, 10 | ✅ |
| N1~N12 (비기능) | 11 (verify-dod.sh) + 전 티켓에서 typecheck/build 유지 | ✅ |
| E1~E12 (엣지케이스) | 06, 07 (서버 사이드 케이스), 10 (web 사이드 E1/E7), 11 (smoke 통합) | ✅ |

### 설계 결정 → 티켓

| 설계 결정 | 관련 티켓 | 커버 |
|----------|----------|------|
| 신규 4개 워크스페이스 (defi, defi-react, defi-http, wasm-crypto) | 01 | ✅ |
| Vendor copy + rebrand `@hq/*` → `@seabw/*` | 03, 04, 05 | ✅ |
| wasm-crypto base64 plaintext stub | 02 | ✅ |
| Pipeline 도메인 (`/pipeline/{resolve,build-step,step-complete,calculate}`) | 06 | ✅ |
| 세션 store in-memory + TTL 30m + LRU 100 | 06 | ✅ |
| MCP server stdio + 6 tools + `/agent/tools/execute` | 07 | ✅ |
| Free-form zod predicate + truncate (64KB) | 07 | ✅ |
| 기존 도메인 PoolDTO 채택 | 08 | ✅ |
| defi-cli 단일 컷오버 | 09 | ✅ |
| Survey result → prompt 인젝션 | 10 | ✅ |
| TypeScript strict + smoke test로 회귀 봉인 | 11 | ✅ |

## Step 상세
- [Step 01: 워크스페이스 스캐폴딩](step-01-workspace-scaffolding.md)
- [Step 02: wasm-crypto stub](step-02-wasm-crypto-stub.md)
- [Step 03: @seabw/defi-http vendor copy](step-03-defi-http-vendor.md)
- [Step 04: @seabw/defi vendor copy](step-04-defi-vendor.md)
- [Step 05: @seabw/defi-react vendor copy](step-05-defi-react-vendor.md)
- [Step 06: NestJS pipeline 도메인](step-06-pipeline-domain.md)
- [Step 07: MCP server + tools](step-07-mcp-server.md)
- [Step 08: 기존 도메인 PoolDTO 마이그레이션](step-08-domain-migration.md)
- [Step 09: defi-cli 폐기](step-09-defi-cli-purge.md)
- [Step 10: web 재배선 + survey](step-10-web-rewiring.md)
- [Step 11: DoD verify + smoke + 문서](step-11-verify-and-docs.md)

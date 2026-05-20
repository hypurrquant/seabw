# HypurrQuant LP 파이프라인 이식 + defi-cli 폐기 - v1.1.0

## 문제 정의

### 현상
- 현재 seabw(v1.0.0 완료 시점)의 DeFi 실행 경로는 `apps/server`의 `defi-cli` 외부 바이너리 호출 + 결정론적 `plan composer` 조합으로 구성되어 있다 (`apps/server/src/domains/plan/internal/composer.ts`, `apps/server/src/lib/defi-cli.ts`).
- 그 결과 다음 세 가지가 동시에 부재한다:
  1. **AI dynamic query** — codex(acpx) agent는 자연어 대화만 수행하고, "조건에 맞는 LP 풀을 조회" 같은 LLM-driven tool 호출 경로가 없다.
  2. **Multi-step LP 실행** — defi-cli는 single-tx 모델 위주이고, LP의 mint/increase/decrease/collect + swap 진입 + 필요 시 bridge가 얽힌 multi-step recipe를 서버에서 오케스트레이션하는 pipeline이 없다.
  3. **LP 커버리지 부족** — defi-cli의 LP 지원은 HyperEVM의 KittenSwap/Ramses/Hybra/HyperSwap/project-x/Nest 같은 DEX를 포괄하지만, 이를 추천·실행에 활용할 만한 read DTO(`PoolDTO`, tick 분포)와 hook이 seabw 내부에 없다.
- 반면 `/Users/mousebook/Documents/side-project/HypurrQuant_FE` 모노레포에는 LP 전 영역(read DTO + React hook/store + atoms + pipeline engine + NestJS pipeline-resolve 도메인 + MCP tool 노출용 acpx adapter)이 이미 운영 중이다.

### 원인
- v1.0.0(monorepo + Codex agent 도입)은 "MCP tool 영역 미이식 / defi-cli 보전 / plan composer 결정론 유지"를 **명시적 비목표**로 잡고 출발했다 (`docs/phases/v1.0.0-monorepo-codex/README.md`).
- 그 결정은 "프로토타입 단계에서는 외부 바이너리 한 줄로 calldata를 받는 게 가장 빠르다"는 판단에서 나왔지만, 이후 프로젝트 방향이 **"투자자 성향 분석 → 클러스터링된 온체인 자산 추천 → AI가 직접 데이터를 조회하며 실행 가능한 multi-step plan을 제시"** 로 구체화되면서 defi-cli 모델로는 부족함이 드러났다.
- defi-cli는 본질적으로 "broadcast-by-default" CLI이고 calldata-only / multi-step / 서버 세션 유지가 1차 기능이 아니다. 반면 HQ pipeline-resolve는 처음부터 `/build-step` (calldata 반환) → 클라 서명 → `/step-complete` (hash 보고) 패턴으로 설계되어 있어 seabw의 user-custody 원칙과 정합.

### 영향
- **개발자**: AI가 호출할 수 있는 read/write 툴 없이는 "유저 성향에 맞춰 후보 LP를 좁히고 실행 제안" 시나리오를 구현할 수 없다.
- **유저**: 추천이 카탈로그/휴리스틱 수준에 머무르고, 멀티-스텝(예: USDC → swap → mint LP NFT → stake)을 한 번에 실행할 수 없다.
- **운영**: 두 가지 backend(defi-cli + 향후 HQ pipeline)을 동시에 유지하면 라우팅·세션·서명 정책이 갈라져 감사·디버깅 비용이 폭발한다.
- **HQ 자산 미활용**: 이미 검증된 `executor.ts`(722 LOC) + atoms 세트 + MCP tool layer + pool DTO 트리가 그대로 있는데 가져오지 않으면 같은 코드를 새로 쓰게 된다.

### 목표
1. **HQ LP 전 영역을 vendor copy로 이식**한다 — read(`packages/core/defi/lp/**`, `packages/react/defi/lp/**`) + write(`packages/core/defi/routing/atoms/**`, `packages/core/defi/pipeline/**`, swap/bridge 의존 부분) + server(`apps/server/src/domains/pipeline-resolve/**`) + AI execution layer(`apps/server/tools/hypurrquant-mcp-server.ts` + acpx adapter MCP tool 등록).
   - 신설 워크스페이스 `packages/defi`(= `@seabw/defi`)에 라이브러리 코드를 두고, NestJS 도메인은 `apps/server/src/domains/pipeline/`에 둔다.
   - 네임스페이스 `@hq/*` → `@seabw/*` 일괄 rebrand.
2. **defi-cli 의존을 완전히 폐기**한다.
   - `apps/server/src/lib/defi-cli.ts` 삭제, `agent/tools.ts` allowlist의 `defi.*` 13개 제거, `apps/server/.../yields.ts`의 live refresh 경로 제거, env(`DEFI_CLI_BIN`, `DEFIPILOT_*`) 정리.
   - 기존 4개 API(`POST /api/plan`, `POST /api/plan/rehydrate`, `GET /api/marketplace/yields`, `POST /api/precheck` 등)는 외부 계약 유지하되 내부 구현을 HQ pipeline 위로 옮긴다(또는 단계적 deprecate).
3. **AI dynamic query 경로**를 codex(acpx) 위에 얹는다.
   - 시스템 프롬프트에 `PoolDTO` 스펙 + 투자자 tendency 인젝션.
   - MCP tool로 `lp.pool.query(filter)` 노출 — AI가 `PoolDTO` 필드에 대한 zod predicate를 자유 작성하면 서버가 후보를 필터·정렬·truncate해서 반환.
   - 추가 tool: `lp.pool.detail(poolId)`, `lp.recipe.compose(input)`, `pipeline.build_step(stepId)`, `pipeline.step_complete(stepId, txHash)`.
4. **유저 흐름 1-2-3 연결**: 설문 결과 + 투자자 tendency → 대화 시작 → AI가 tool로 데이터 조회·좁히기 → 최종 multi-step calldata를 사용자에게 제안(서명은 wagmi 클라).

### 비목표 (Out of Scope)
- ❌ **Lending 이식** (HQ `packages/core/defi/lending/**` 전체) — 다음 phase.
- ❌ **Perp 이식** (Hyperliquid 주문/포지션) — 다음 phase.
- ❌ **wasm-crypto 정식 이식** — `@seabw/wasm-crypto`는 base64 평문 stub으로 진행 (해커톤). 실제 암호화는 후속.
- ❌ **HQ 업스트림 자동 sync** — 1회성 vendor copy. HQ 변경 사항은 수동 cherry-pick.
- ❌ **Strategy assembly 깊은 부분** (`packages/core/defi/strategy/**`) — LP 진입에 필요한 최소 atoms만 가져온다.
- ❌ **HQ telegram/world/mobile miniapp 자산** — 이번 phase 무관.
- ❌ **기존 `src/` 디렉토리 정리** — v1.0.0과 동일 정책으로 휴면 유지(삭제 금지).
- ❌ **APR/APY 단위 변환 레이어** — AI가 raw DTO를 그대로 소비. 프롬프트에 단위 메모 한 줄만.
- ❌ **추천 결과 UI 시각 디자인** — AI 응답을 화면에 띄우는 최소 wiring까지만. 카드/차트/시각화는 별도 phase.
- ❌ **설문 UI 신규 제작** — 이미 존재한다는 사용자 확인. 결과(tendency report)를 prompt input으로 잇는 부분만.
- ❌ **HQ 업스트림과 동일한 모든 DEX 동시 지원** — 1차 wave는 HyperEVM(KittenSwap, Ramses, Hybra, HyperSwap, project-x, Nest) + 필요 시 Base(Aerodrome, UniswapV3). 그 외는 다음 wave.

## 제약사항

### 기술적 제약
- **Node ≥ 20, pnpm ≥ 10** (v1.0.0과 동일).
- **NestJS 11** apps/server 유지. HQ pipeline-resolve 도메인을 NestJS 11 모듈로 흡수.
- **Next.js 15 App Router** apps/web 유지.
- **vendor copy 방식**: HQ 파일을 그대로 복사하고 import 경로만 일괄 치환(`@hq/*` → `@seabw/*`). 동기화는 수동.
- **Codex 실행 환경**: `acpx` + `@zed-industries/codex-acp` 바이너리 로컬 PATH 가정(v1.0.0과 동일). 미설치 시 MCP 도구는 호출되지 않고 codex adapter는 휴리스틱 fallback.
- **viem ≥ 2.48** (HQ 의존성과 동일). `@wormhole-foundation/sdk`, `lighter-ts-sdk` 등 HQ가 쓰는 LP·bridge SDK 동반 설치.
- **wasm-crypto stub**: `@seabw/wasm-crypto`의 `encrypt/decrypt`는 base64 항등 함수. HQ API 응답이 평문임을 가정(해커톤 동안 HypurrQuant 측이 평문 엔드포인트 제공 예정).
- **세션 상태**: HQ pipeline-resolve는 NestJS 인메모리 `Map<sessionKey, sharedState>`로 build-step 간 상태를 유지. v1.1.0은 동일 in-memory로 가되 인터페이스만 후속 Redis 교체 가능하게 둔다.

### 비즈니스 제약
- **외부 API 계약 보존**: v1.0.0의 6개 API URL/req/res shape는 변경하지 않는다. 단, 내부 구현이 defi-cli → HQ pipeline으로 바뀐다(응답에 새 필드 추가는 허용).
- **user-custody 원칙 유지**: 서명은 항상 사용자 wagmi. 서버는 calldata만 반환. private key는 서버에 둘 수 없다.
- **단발 phase, 한 번에 cutover**: v1.0.0과 동일 방침. 점진적 dual-write 사용하지 않는다. defi-cli 경로는 phase 종료 시점에 한 번에 제거.

### 시간 제약
- 해커톤 일정 내 완료를 가정. wasm-crypto/Redis/풀 DEX 커버리지 등 후행으로 미루는 항목이 다수.
- v1.0.0이 이미 완료된 상태이므로 monorepo 기반 작업은 즉시 가능.

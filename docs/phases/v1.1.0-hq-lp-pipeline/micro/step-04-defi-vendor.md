# Step 04: @seabw/defi vendor copy (LP + routing + pipeline)

## 메타데이터
- **난이도**: 🟠 중간 (가장 분량 큰 단일 작업)
- **롤백 가능**: ✅
- **선행 조건**: Step 01, 02, 03

---

## 1. 구현 내용

HQ `packages/core/defi/**` 의 LP 의존부만 `packages/defi/**` 로 복사 + rebrand.

### 복사 대상

| HQ 원본 | seabw 대상 | 비고 |
|---|---|---|
| `packages/core/defi/lp/{types,identity,capability,api,registry}.ts` | `packages/defi/lp/*.ts` | LP 기본 타입/레지스트리 |
| `packages/core/defi/lp/pool/**` | `packages/defi/lp/pool/**` | PoolDTO/tick math/read/utils |
| `packages/core/defi/lp/position/**` | `packages/defi/lp/position/**` | position state/fetch/reward strategy |
| `packages/core/defi/lp/recipe/**` | `packages/defi/lp/recipe/**` | multi-step recipe builder |
| `packages/core/defi/lp/mint/**` | `packages/defi/lp/mint/**` | mint DTO + preflight + native-input |
| `packages/core/defi/lp/remove/**` | `packages/defi/lp/remove/**` | remove path |
| `packages/core/defi/routing/atoms/{index,types,bridgeRelay,errors}.ts` | `packages/defi/routing/atoms/*.ts` | atom 기본 |
| `packages/core/defi/routing/atoms/<LP 필요 atom들>` | `packages/defi/routing/atoms/**` | swap atoms 중 LP 진입에 쓰이는 것 cherry-pick |
| `packages/core/defi/routing/swap/{operation,provider,build-resolved-stages}.ts` + `providers/**` | `packages/defi/routing/swap/**` | swap quote → calldata |
| `packages/core/defi/routing/bridge/{types,build-resolved-stages}.ts` + `relay/**` + `wormhole/**` | `packages/defi/routing/bridge/**` | bridge (LP entry용) |
| `packages/core/defi/routing/stages/types.ts` | `packages/defi/routing/stages/types.ts` | ResolvedStage 등 |
| `packages/core/defi/pipeline/{executor,types,client,local-stages,stage-builder,_local-port,_server-port}.ts` | `packages/defi/pipeline/*.ts` | 실행 엔진 |
| `packages/core/defi/_shared/**` | `packages/defi/_shared/**` | 공통 유틸 |
| `packages/core/defi/**/__tests__/**` (LP/pipeline/routing 한정) | `packages/defi/**/__tests__/**` | 테스트 이식 |

### 제외 대상 (반드시 복사하지 않음)
- `packages/core/defi/lending/**`
- `packages/core/defi/perp/**`
- `packages/core/defi/strategy/**` (LP에 의존 없는 한)
- lending/perp만 import하는 atoms (`approve` 같은 공통은 유지)

### 수정 작업
- 모든 `from '@hq/...'` → `from '@seabw/...'`
  - `@hq/core/lib/*` → `@seabw/defi-http/*` (http/viem-client/rpc)
  - `@hq/core/defi/*` → 패키지 내부 상대 경로 또는 `@seabw/defi/*`
  - `@hq/core/{token,balance,formatters,config,auth}/*` → 필요한 만큼 함께 이식 또는 cherry-pick. 본 step 내에서 발견되면 같이 복사.
  - `@hq/wasm-crypto` → `@seabw/wasm-crypto`
- `pipeline/types.ts` 가 lending 타입을 type-only import 하더라도 그대로 둠 (조사 결과 안전). 단, 실제로 lending 디렉토리 import 시 fail 하므로 type-only 모듈 stub (`packages/defi/_shims/lending-types.ts`) 추가하여 `LendingMarketRef`, `LendingId` 등 사용된 이름만 `type Foo = unknown` 으로 선언
- `packages/defi/index.ts` 에서 LP/routing/pipeline의 주요 심볼 re-export
- HQ가 React에 의존하지 않는다는 조사 결과를 코드 상에서 재확인 (`rg "react\|useState\|useEffect" packages/defi` → 0 hits 보장)

### 테스트 이식
- HQ `packages/core/defi/pipeline/__tests__/*` 의 executor/preflight 테스트를 그대로 이식
- HQ `packages/core/defi/lp/__tests__/*` 이식
- `pnpm -F @seabw/defi test` 통과

## 2. 완료 조건
- [ ] `packages/defi/{lp,routing,pipeline,_shared}/**` 디렉토리 존재
- [ ] `rg "@hq/" packages/defi` → 0 hits
- [ ] `rg "from ['\"]react['\"]" packages/defi` → 0 hits (React 비의존 확인)
- [ ] `rg "defi/(lending|perp)" packages/defi` → lending shim 외 0 hits
- [ ] `pnpm -F @seabw/defi build` 성공
- [ ] `pnpm -F @seabw/defi test` 통과 (HQ에서 이식한 unit test)
- [ ] `import { PoolDTO, RecipeAtom, executor } from '@seabw/defi'` 가 외부 워크스페이스에서 resolution OK
- [ ] DoD F1.2, F1.3 충족 (`diff -rq` 차이는 import 경로만)

## 3. 롤백 방법
- `git checkout HEAD -- packages/defi/`
- 다음 step(05, 06, 07)이 시작되기 전이면 다른 영향 없음

---

## Scope

### 신규 생성 파일 (디렉토리 그룹 단위)
```
packages/defi/lp/{types,identity,capability,api,registry}.ts
packages/defi/lp/pool/**
packages/defi/lp/position/**
packages/defi/lp/recipe/**
packages/defi/lp/mint/**
packages/defi/lp/remove/**
packages/defi/routing/atoms/**
packages/defi/routing/swap/**
packages/defi/routing/bridge/**
packages/defi/routing/stages/types.ts
packages/defi/pipeline/{executor,types,client,local-stages,stage-builder,_local-port,_server-port}.ts
packages/defi/_shared/**
packages/defi/_shims/lending-types.ts   # type-only stub
packages/defi/__tests__/**              # HQ에서 이식
packages/defi/index.ts                  # 공개 API re-export
```

### 수정 대상 파일
- `packages/defi/package.json` — `viem`, `zod`, `@wormhole-foundation/sdk`, `lighter-ts-sdk`, `@seabw/defi-http`, `@seabw/wasm-crypto` 의존성 추가

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| viem ≥ 2.48 | 의존 (defi-http 통해 전이) | RPC 호출 |
| @wormhole-foundation/sdk ^4.18 | 신규 dep | bridge atoms |
| lighter-ts-sdk ^1.0.11 | 신규 dep | 특정 DEX SDK |
| zod | 신규 dep | 스키마 검증 |
| @seabw/defi-http | workspace dep | http/viem 의존성 |
| @seabw/wasm-crypto | workspace dep (전이) | 평문 stub |

### Side Effect 위험
- 위험 1: HQ가 추가 디렉토리(`token/`, `balance/`, `formatters/`, `config/`, `auth/`)를 import하는데 본 step에서 미리 식별 못 한 부분이 있을 수 있음. 대응: 빌드 실패 시 누락 파일을 한 묶음으로 추가 (보조 step 없이 본 step 안에서 해결).
- 위험 2: `_shims/lending-types.ts`의 `unknown` 타입이 너무 약해 executor 호출부에서 다른 타입 오류 유발 가능. 대응: 발견 시 더 구체적인 stub type 작성.
- 위험 3: viem 버전이 seabw 다른 패키지와 다를 경우 dedup 실패. 대응: 루트 `package.json`에서 `resolutions`/`overrides`로 viem 단일 버전 강제.
- 위험 4: `@wormhole-foundation/sdk` 가 wasm/native binding을 가져 build 환경 제약. 대응: HQ 빌드 환경과 동일 (node 20) 가정.

### 참고할 기존 패턴
- HQ `packages/core/defi/pipeline/executor.ts` (722 LOC) — 가장 큰 단일 파일, 그대로 복사
- HQ `packages/core/defi/lp/pool/types.ts` (11.3 KB) — PoolDTO 정의

---

## FP/FN 검증

### False Positive
| Scope 항목 | 근거 | 판정 |
|---|---|---|
| lp/{types,identity,capability,api,registry}.ts | LP 기본 (read+write 양쪽 필요) | ✅ |
| lp/pool/** | PoolDTO + tick math | ✅ |
| lp/position/** | position read + reward strategy (LP 추천에 사용) | ✅ |
| lp/recipe/** | LP write multi-step | ✅ |
| lp/mint/** | mint preflight + native input | ✅ |
| lp/remove/** | remove path (LP write 완성도) | ✅ |
| routing/atoms/** | atom 기본 + LP 진입에 필요한 swap atoms | ✅ |
| routing/swap/** | swap 진입 atoms (LP entry시 USDC→ETH 등) | ✅ |
| routing/bridge/** | bridge (다른 체인에서 LP 진입) | ⚠️ HyperEVM 단일 체인 가정과 충돌 가능 — but executor가 bridge stage 의존 시 컴파일 위해 유지. v1.1.0 데모에선 미사용. |
| pipeline/** | 실행 엔진 (필수) | ✅ |
| _shared/** | 공통 유틸 | ✅ |
| _shims/lending-types.ts | type-only 의존 끊기 | ✅ |
| index.ts | 공개 API | ✅ |

### False Negative
| 구현 내용 | Scope 포함 | 판정 |
|---|---|---|
| HQ `token/`, `balance/`, `formatters/`, `config/`, `auth/` 의 일부 | (Scope에서 명시 X — 빌드 시 발견하여 추가 정책) | ⚠️ 사전 식별 권장. 본 step 시작 시 grep으로 import 그래프 추출하여 cherry-pick |
| `@hq/` → `@seabw/` codemod | (Scope 항목별로 별도 기록 X — 전 파일 일괄) | OK |
| Lending/perp 디렉토리 제외 | (제외 정책으로 명시) | OK |

### 검증 체크리스트
- [x] Scope의 모든 디렉토리가 구현 내용과 연결됨
- [ ] **사전 수행 권장**: 본 step 시작 시 HQ에서 `rg "@hq/core/(token|balance|formatters|config|auth)" packages/core/defi/{lp,routing,pipeline}` 로 의존 그래프 추출 → 누락 디렉토리 식별 후 Scope에 추가
- [x] 불필요한 파일(lending/perp/strategy) 제외 정책 명시
- [x] React 비의존 grep 검증 조건 포함

### 검증 통과: ✅ (단, 사전 의존 그래프 추출 후 Scope 보강 필수)

---

→ 다음: [Step 05: @seabw/defi-react vendor copy](step-05-defi-react-vendor.md)

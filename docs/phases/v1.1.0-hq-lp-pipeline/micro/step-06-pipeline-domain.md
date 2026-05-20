# Step 06: NestJS pipeline 도메인 + 세션 store

## 메타데이터
- **난이도**: 🔴 어려움 (서비스 경계 신설, 세션 상태 관리)
- **롤백 가능**: ✅
- **선행 조건**: Step 04 (executor + types 필요)

---

## 1. 구현 내용

HQ `apps/server/src/domains/pipeline-resolve/**` 를 seabw `apps/server/src/domains/pipeline/**` 로 포팅.

### 구조
```
apps/server/src/domains/pipeline/
├─ pipeline.module.ts
├─ pipeline.controller.ts             # 4 endpoints
├─ application/
│  ├─ resolve.service.ts              # executor.plan() 호출
│  ├─ build-step.service.ts           # 단일 stage 실행 → calldata
│  ├─ step-complete.service.ts        # receipt 파싱 + sharedState advance
│  └─ calculate.service.ts            # dry-run 추정
├─ atoms/
│  └─ (LP 관련 atom payload helper)   # HQ pipeline-resolve/atoms 이식
├─ dto/
│  ├─ resolve.dto.ts
│  ├─ build-step.dto.ts
│  ├─ step-complete.dto.ts
│  ├─ calculate.dto.ts
│  └─ atom-payload.dto.ts
└─ session/
   ├─ session-store.ts                # Map<sessionId, SharedState> + TTL + LRU
   ├─ session.types.ts                # SharedState zod schema
   └─ session-cleanup.cron.ts         # @nestjs/schedule cron (1분 주기)
```

### 4 endpoints

| Method | Path | DTO 입력 | DTO 출력 |
|---|---|---|---|
| POST | `/pipeline/resolve` | `ResolveRequest` | `ResolveResponse` (sessionId/totalSteps/firstStep) |
| POST | `/pipeline/build-step` | `BuildStepRequest` (sessionId, stepIndex) | `BuildStepResponse` (to/data/value/chainId/gasHint) |
| POST | `/pipeline/step-complete` | `StepCompleteRequest` (sessionId, stepIndex, txHash, receiptStatus) | `StepCompleteResponse` (done, nextStep?, result?) |
| POST | `/pipeline/calculate` | `CalculateRequest` (recipe, userAddress, chainId) | `CalculateResponse` (expectedOut, priceImpact, route) |

### 세션 store
- 자료구조: `Map<sessionId, SharedState>`
- TTL: 30분 (만료 시 cleanup cron이 제거)
- LRU cap: 100 (생성 시 size > 100이면 가장 오래된 evict)
- API: `create(state) → sessionId`, `get(sessionId)`, `update(sessionId, mutator)`, `touch(sessionId)` (만료 시간 연장)
- 동시성: 같은 sessionId의 build-step / step-complete 직렬화 (간단한 `AsyncLock` 또는 mutex per session)

### 데이터 흐름
- `/pipeline/resolve`: `executor.plan(recipe)` → SharedState 생성 + sessionId 발급 → firstStep 반환
- `/pipeline/build-step`: 세션에서 현재 step 로드 → `executor.encode(step, sharedState)` → calldata 반환
- `/pipeline/step-complete`: receipt 파싱 → `executor.advance(sharedState, txReceipt)` → sharedState 변형 → 다음 step 또는 done
- `/pipeline/calculate`: 세션 미생성 dry-run. `executor.simulate(recipe)` → 비용 추정

### 에러 응답
- 404 SESSION_NOT_FOUND
- 410 SESSION_EXPIRED
- 409 SESSION_BUSY (동시 호출)
- 503 RPC_UNAVAILABLE
- 422 RECIPE_INVALID

### 테스트
- Nest TestingModule + 모킹된 viem provider
- E2E sequence: resolve → buildStep → mock signing → stepComplete → assert nextStep 또는 done
- 세션 TTL: timer mock으로 만료 후 get → undefined
- LRU: 101개 세션 생성 시 첫 번째 evict

## 2. 완료 조건
- [ ] `apps/server/src/domains/pipeline/` 전 파일 존재 + `PipelineModule` 가 `app.module.ts` 에 등록
- [ ] 4 endpoints가 `curl`로 응답함 (DoD F3.2~F3.5 검증 명령 통과)
- [ ] 세션 TTL/LRU 유닛 테스트 통과 (DoD F3.7)
- [ ] `pnpm -F @seabw/server test` 통과
- [ ] `pnpm -F @seabw/server build` 성공
- [ ] `curl localhost:4000/pipeline/build-step -X POST -d '{"sessionId":"00000000-0000-0000-0000-000000000000","stepIndex":0}'` → 410 SESSION_EXPIRED (또는 404)

## 3. 롤백 방법
- `git checkout HEAD -- apps/server/src/domains/pipeline/ apps/server/src/app.module.ts`
- `app.module.ts` 에서 `PipelineModule` import 제거

---

## Scope

### 신규 생성 파일
```
apps/server/src/domains/pipeline/pipeline.module.ts
apps/server/src/domains/pipeline/pipeline.controller.ts
apps/server/src/domains/pipeline/application/{resolve,build-step,step-complete,calculate}.service.ts
apps/server/src/domains/pipeline/atoms/**
apps/server/src/domains/pipeline/dto/*.dto.ts
apps/server/src/domains/pipeline/session/{session-store,session.types,session-cleanup.cron}.ts
apps/server/src/domains/pipeline/__tests__/*.spec.ts
```

### 수정 대상 파일
- `apps/server/src/app.module.ts` — `PipelineModule` import
- `apps/server/package.json` — `@nestjs/schedule` 추가 (cron), `@seabw/defi`, `@seabw/defi-http` workspace dep

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| @nestjs/schedule | 신규 dep | session cleanup cron |
| @seabw/defi | workspace dep | executor/types |
| @seabw/defi-http | workspace dep | viem provider |
| uuid | 신규 dep (또는 crypto.randomUUID 사용) | sessionId 생성 |
| async-mutex | 선택 dep | per-session mutex |

### Side Effect 위험
- 위험 1: cron + 메모리 store는 NestJS Hot Reload(dev) 시 reset됨. 개발 중 세션 손실 가능. **수용** (hackathon).
- 위험 2: executor가 RPC 호출에 의존하므로 build-step latency가 RPC 응답에 묶임. 대응: 응답 timeout 10s + 사용자에게 안내.
- 위험 3: 다른 도메인이 `pipeline`에 직접 import하지 않도록 — 단방향(외부 호출만 통해). 대응: ESLint boundary rule (선택).
- 위험 4: HQ의 pipeline-resolve가 lending/perp 도메인을 함께 다뤘다면 dto/atoms에 그 잔재가 있을 수 있음. 대응: 복사 후 LP 외 atom payload 제거.

### 참고할 기존 패턴
- HQ `apps/server/src/domains/pipeline-resolve/pipeline-resolve.controller.ts` (59 LOC)
- HQ `apps/server/src/domains/pipeline-resolve/application/*` — service 분리 구조
- seabw 기존 도메인 (`apps/server/src/domains/plan/`) — NestJS controller/service/module 패턴

---

## FP/FN 검증

### False Positive
| Scope 항목 | 근거 | 판정 |
|---|---|---|
| pipeline.controller.ts | 4 endpoints | ✅ |
| 4 services | endpoint별 분리 | ✅ |
| atoms/ | HQ pipeline-resolve/atoms 이식 (LP 한정) | ✅ |
| 5 dto | endpoint + atom-payload | ✅ |
| session-store/types/cleanup | TTL + LRU + cron | ✅ |
| __tests__ | unit + e2e | ✅ |

### False Negative
| 구현 내용 | Scope 포함 | 판정 |
|---|---|---|
| `PipelineModule` 등록 | app.module.ts 수정 ✅ | OK |
| `@nestjs/schedule` 의존성 | package.json ✅ | OK |
| Lending/perp atoms 제거 | 정책 명시 | OK |
| 동시성 mutex | session-store.ts 내 구현 (별도 파일 X) | OK |
| 에러 응답 코드 (404/410/409/503/422) | controller에서 처리 | OK |

### 검증 통과: ✅

---

→ 다음: [Step 07: MCP server + tools](step-07-mcp-server.md)

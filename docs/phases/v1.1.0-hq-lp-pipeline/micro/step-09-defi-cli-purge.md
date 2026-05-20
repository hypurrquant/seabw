# Step 09: defi-cli 완전 폐기

## 메타데이터
- **난이도**: 🟠 중간
- **롤백 가능**: ✅ (git revert)
- **선행 조건**: Step 08 (마이그레이션 완료 후라야 호출처 없음)

---

## 1. 구현 내용

### A. 파일 삭제
- `apps/server/src/lib/defi-cli.ts` 삭제
- `apps/server/src/lib/__tests__/defi-cli.test.ts` (있다면) 삭제

### B. tools allowlist 갱신
- `apps/server/src/domains/agent/.../tools.ts` (v1.0.0의 allowlist 파일)
  - `defi.status`, `defi.schema`, `defi.price`, `defi.yield.scan`, `defi.yield.compare`, `defi.lending.rates`, `defi.lp.discover`, `defi.token.balance`, `defi.token.allowance`, `defi.portfolio`, `defi.swap.quote`, `defi.lending.supply`, `defi.lending.withdraw`, `defi.lending.borrow`, `defi.lending.repay`, `defi.lp.add`, `defi.lp.remove`, `defi.lp.farm`, `defi.lp.claim`, `defi.bridge.quote` — 모두 제거
  - `lp.pools.query`, `lp.position.list`, `lp.recipe.compose`, `pipeline.resolve`, `pipeline.buildStep`, `pipeline.stepComplete` — 추가 (Step 07에서 상수로 정의한 것 import)
- `assertToolAllowed` 사용처에서 정확히 6개 tool name만 통과하는지 검증

### C. 환경변수 제거
- `apps/server/.env.example`, `apps/web/.env.local.example`, `docker-compose.yml` (있다면), `scripts/*` 에서:
  - `DEFI_CLI_BIN`, `DEFI_CLI_*`, `DEFIPILOT_USE_FIXTURES`, `DEFIPILOT_DEFI_CLI` 모두 제거
- 신규 env 추가:
  - `SEABW_RPC_URL_HYPEREVM` (필요 시)
  - `SEABW_HQ_API_BASE` (`api.hypurrquant.com`)
  - `SEABW_TOOL_API_URL` (`http://localhost:4000`, MCP server가 NestJS 호출)

### D. 문서 갱신
- `CLAUDE.md` 의 메인 설명: "defi-cli로 calldata를 hydrate한 뒤..." → "HQ pipeline executor가 calldata를 생성하고 사용자가 wagmi로 서명..."
- 부팅 가이드의 defi-cli 설치 안내 제거 → codex CLI 설치 안내 (이미 v1.0.0에 있을 수 있음 — 검증)
- `scripts/verify-dod.sh` — defi-cli grep 항목을 v1.1.0 항목으로 갱신 (Step 11에서 자세히)

### E. 의존성 제거
- `apps/server/package.json` 에서 defi-cli 관련 의존이 있었다면 제거
- 루트 `package.json` 동일

### F. test grep
- `rg "defi-cli|defiCli|DefiCli" apps src packages` → 0 hits 확인 (DoD F2.2)
- `rg "DEFI_CLI_|DEFIPILOT_" apps src docs` → 0 hits (DoD F2.4)

## 2. 완료 조건
- [ ] DoD F2.1 충족 (`apps/server/src/lib/defi-cli.ts` 미존재)
- [ ] DoD F2.2 충족 (소스에서 defi-cli 참조 0)
- [ ] DoD F2.3 충족 (allowlist에서 `defi.*` 0)
- [ ] DoD F2.4 충족 (env 변수 0)
- [ ] DoD F2.5 충족 (README/CLAUDE.md 갱신)
- [ ] `pnpm typecheck` 통과
- [ ] `pnpm -r build` 통과
- [ ] `pnpm -r test` 통과

## 3. 롤백 방법
- 본 step의 PR/commit revert
- 이미 Step 08까지 마이그레이션이 끝났으므로 단순 revert로 defi-cli 복원 시 도메인이 깨질 수 있음 → 전체 phase 롤백 권장

---

## Scope

### 삭제 파일
```
apps/server/src/lib/defi-cli.ts
apps/server/src/lib/__tests__/defi-cli.test.ts  # 있다면
```

### 수정 대상 파일
```
apps/server/src/domains/agent/.../tools.ts        # allowlist 갱신 (Step 07 상수 import)
apps/server/src/domains/agent/.../tools.spec.ts    # 새 6개 tool로 갱신
apps/server/.env.example
apps/web/.env.local.example                        # 있다면
docker-compose.yml                                 # 있다면
scripts/verify-dod.sh                              # Step 11에서 일부 처리
README.md                                          # 부팅 안내 갱신
CLAUDE.md                                          # 메인 설명 갱신
apps/server/package.json                           # 의존성 제거 (있다면)
package.json                                       # 의존성 제거 (있다면)
pnpm-lock.yaml                                     # install 결과
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| 모든 server 도메인 | 간접 영향 | Step 08에서 이미 defi-cli 호출 주석 처리됨 — 본 step에서 import 자체 제거 |
| agent allowlist | 직접 수정 | 6개 신규 tool name으로 교체 |

### Side Effect 위험
- 위험 1: Step 08에서 일부 mock 응답을 남겼을 수 있음. 본 step과 함께 mock 제거하고 실제 `@seabw/defi/lp/api.ts` 호출로 전환. 대응: 본 step 종료 전 각 service의 mock TODO grep으로 잔재 확인.
- 위험 2: env 제거로 dev/staging 배포 시 누락 알림. 대응: `.env.example` 갱신 + README 동시 갱신.
- 위험 3: `verify-dod.sh` 가 v1.0.0 기준 항목을 가짐. Step 11에서 v1.1.0 항목으로 교체.

### 참고할 기존 패턴
- v1.0.0의 `agent/tools.ts` allowlist 패턴 — 동일 형식 유지

---

## FP/FN 검증

### False Positive
| Scope 항목 | 근거 | 판정 |
|---|---|---|
| defi-cli.ts 삭제 | DoD F2.1 | ✅ |
| tools.ts 갱신 | DoD F2.3 | ✅ |
| env 제거 | DoD F2.4 | ✅ |
| README/CLAUDE.md 갱신 | DoD F2.5 | ✅ |
| docker-compose | env 노출 가능성 | ✅ |

### False Negative
| 구현 내용 | Scope 포함 | 판정 |
|---|---|---|
| Step 08 mock 잔재 제거 | service 파일 수정 (Scope에 포함됨) | OK |
| scripts/verify-dod.sh 부분 갱신 | (Step 11에서 일괄) | OK |
| audit-log 등에서 defi-cli 언급 | grep으로 발견 시 제거 | OK (정책으로 포함) |

### 검증 통과: ✅

---

→ 다음: [Step 10: web 재배선 + survey](step-10-web-rewiring.md)

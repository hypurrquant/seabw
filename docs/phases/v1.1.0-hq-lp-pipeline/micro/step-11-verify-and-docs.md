# Step 11: DoD verify + smoke + 문서 갱신

## 메타데이터
- **난이도**: 🟡 보통
- **롤백 가능**: ✅
- **선행 조건**: Step 01~10 모두 완료

---

## 1. 구현 내용

### A. `scripts/verify-dod.sh` 갱신
- v1.0.0이 사용하는 스크립트에 v1.1.0 항목 추가 또는 v1.1.0 전용 섹션
- 검증 항목 (DoD 매핑):
  - `rg "@hq/" packages/defi packages/defi-react packages/defi-http` → 0 (F1.7)
  - `rg "react\|useState\|useEffect" packages/defi/src` → 0 (F1.X React 비의존)
  - `[ ! -f apps/server/src/lib/defi-cli.ts ]` (F2.1)
  - `rg "defi-cli\|defiCli\|DefiCli\|spawn\(.*defi" apps src packages` → 0 (F2.2)
  - `rg "^\s*['\"]defi\." apps/server/src/domains/agent` → 0 (F2.3)
  - `rg "DEFI_CLI_\|DEFIPILOT_" apps src docs .env* 2>/dev/null` → 0 (F2.4)
  - `rg "PipelineModule" apps/server/src/app.module.ts` → ≥1 (F3.1)
  - 시스템 프롬프트 PoolDTO 필드 grep (F4.5)
- exit 0 시 모든 항목 통과

### B. 통합 smoke 테스트
- 시나리오 1: "AI 추천 dynamic query"
  - dev 서버 부팅 → web 접속 → survey 완료 → chat 진입 → "TVL 1M 이상 USDC 풀 보여줘" → codex가 `lp.pools.query` 호출 → 풀 목록 응답
- 시나리오 2: "LP mint multi-step (mocked wallet)"
  - chat에서 "1 USDC mint" → `lp.recipe.compose` → `pipeline.resolve` → web에 서명 요청 → mocked 서명 → `pipeline.stepComplete` → done
- Playwright + 사전 녹화 또는 수동 검증

### C. 문서 갱신
- `CLAUDE.md`
  - "현재 페이즈" → "v1.1.0 ✅ 완료" + 완료일 (PROGRESS.md와 sync)
  - "구조" 트리에 `packages/` 추가
  - "부팅" 절에 codex CLI 사전 조건 + MCP 등록 명령 안내
  - "검증" 절에 새 verify 스크립트 결과 포함
- `README.md` (루트, 있다면) 동일 갱신
- `docs/phases/v1.1.0-hq-lp-pipeline/PROGRESS.md`
  - Step 5 = ✅ 완료 (Step 5는 개발 = Step 01~10 모두 완료를 의미)
- `docs/phases/v1.1.0-hq-lp-pipeline/handover.md` (선택, 다음 phase 인계 메모)
- HQ upstream을 별 프로젝트로 간주한다는 정책을 `docs/architecture/vendor-policy.md` 같은 곳에 남기기 (선택)

### D. 의존성/lockfile 검증
- DoD N11: `pnpm-lock.yaml` diff가 phase 범위와 일치 (viem/wormhole/zustand/react-query/@modelcontextprotocol/sdk 등만 추가)
- `pnpm audit` (선택) — 신규 dep의 알려진 취약점 확인

### E. CI hook (선택, 시간 허용 시)
- GitHub Actions/PR 워크플로에 `pnpm verify:dod` 자동 실행

## 2. 완료 조건
- [ ] `bash scripts/verify-dod.sh` exit 0 (DoD N5/N6 + F1.7/F2.1~F2.4 등 자동 검증)
- [ ] `pnpm typecheck` exit 0 (N1)
- [ ] `pnpm lint` exit 0 (N2)
- [ ] `pnpm -r build` exit 0 (N3)
- [ ] `pnpm -r test` exit 0 (N4)
- [ ] `pnpm dev:web` 부팅 OK + 페이지 200 (N7)
- [ ] `pnpm dev:server` 부팅 OK + `curl localhost:4000/health` 200 (N8)
- [ ] codex CLI 미설치 시 server warning + 정상 부팅 (N9, E1)
- [ ] `node apps/server/tools/seabw-mcp-server.ts` stdio list_tools 응답 (N10)
- [ ] CLAUDE.md "현재 페이즈" = v1.1.0 ✅ 완료 + 완료일
- [ ] PROGRESS.md Step 5 = ✅ 완료
- [ ] Smoke 시나리오 1, 2 통과 (수동 또는 Playwright)

## 3. 롤백 방법
- 본 step은 검증·문서 중심이므로 코드 변경 적음
- 회귀 발견 시 해당 Step (06/07/10 등)에 fix 추가하고 verify-dod.sh 재실행

---

## Scope

### 수정 대상 파일
```
scripts/verify-dod.sh                              # v1.1.0 항목 추가
CLAUDE.md                                          # 현재 페이즈 + 구조 + 검증
README.md                                          # 갱신 (있다면)
docs/phases/v1.1.0-hq-lp-pipeline/PROGRESS.md     # Step 5 완료
docs/phases/v1.1.0-hq-lp-pipeline/handover.md     # (선택)
docs/architecture/vendor-policy.md                 # (선택)
.github/workflows/*.yml                            # (선택) verify-dod 호출
e2e/v1.1.0-smoke.spec.ts                           # Playwright 시나리오
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| 모든 이전 step 산출물 | 검증 대상 | 변경 없음, grep/build/test 실행 |

### Side Effect 위험
- 위험 1: verify-dod.sh가 잘못된 grep 패턴으로 false negative. 대응: 각 항목 수동 한 번 검증 후 commit.
- 위험 2: codex CLI 미설치 환경에서 smoke 시나리오 1을 자동화 불가. 대응: smoke는 수동 또는 모킹된 codex stub로 진행.

### 참고할 기존 패턴
- v1.0.0의 `scripts/verify-dod.sh` (현존 시) — 동일 형식 확장

---

## FP/FN 검증

### False Positive
| Scope 항목 | 근거 | 판정 |
|---|---|---|
| verify-dod.sh | DoD 자동 검증 | ✅ |
| CLAUDE.md/PROGRESS.md | 페이즈 종료 표시 | ✅ |
| e2e smoke spec | 통합 검증 | ✅ |
| handover.md / vendor-policy.md | (선택) 다음 phase 인계 | OK (선택) |

### False Negative
| 구현 내용 | Scope 포함 | 판정 |
|---|---|---|
| 모든 DoD F/N/E 항목 검증 | verify-dod.sh + 수동 체크리스트 | OK |
| 의존성 lockfile 리뷰 | git diff (도구 호출, 코드 X) | OK |

### 검증 통과: ✅

---

→ 페이즈 종료: [phase-complete 가이드 참고](/Users/mousebook/.claude/skills/phase-workflow/phase-complete.md)

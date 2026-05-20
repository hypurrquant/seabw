# DoD - v1.1.0

## 완료 조건

| # | 조건 | 검증 방법 |
|---|------|----------|
| 1 | `apps/server/src/lib/defi-cli.ts` 미존재 | `[ ! -f apps/server/src/lib/defi-cli.ts ]` |
| 2 | 코드에서 defi-cli 참조 0 | `rg "defi-cli\|defiCli\|DefiCli" apps src 2>/dev/null` → 0 hits (`node_modules` 제외) |
| 3 | env `DEFI_CLI_*`, `DEFIPILOT_*` 미존재 | `rg "DEFI_CLI_\|DEFIPILOT_" apps src docs .env* 2>/dev/null` → 0 hits |
| 4 | `apps/server/src/domains/` 가 비어 있거나 placeholder만 | `ls apps/server/src/domains/ 2>/dev/null` → 결과 없음 또는 README 한 줄 |
| 5 | `apps/server/src/app.module.ts` 의 `imports` 가 `[]` 또는 비-DeFi 모듈만 | `cat apps/server/src/app.module.ts` 수동 확인 |
| 6 | `pnpm -F @seabw/server build` 성공 | exit 0 |
| 7 | `apps/web/src/app/{portfolio,risks}/` 디렉토리 미존재 | `[ ! -d apps/web/src/app/portfolio ] && [ ! -d apps/web/src/app/risks ]` |
| 8 | 옛 components 11개 (basket-bar, basket-review, dag-node, intent-input, marketplace, plan-review, portfolio-summary, product-detail, sign-flow, stage-indicator, demo-banner) 미존재 | `for f in basket-bar basket-review dag-node intent-input marketplace plan-review portfolio-summary product-detail sign-flow stage-indicator demo-banner; do [ ! -f apps/web/src/components/$f.tsx ] || echo MISS $f; done` → 출력 없음 |
| 9 | `pnpm -F @seabw/web build` 성공 | exit 0 |
| 10 | HQ worktree(`feat/seabw-integration`)에 `AGENT_SYSTEM_PROMPT_FILE` env hook 적용 | worktree에서 `rg "AGENT_SYSTEM_PROMPT_FILE" apps/server/src` hit |
| 11 | `docs/seabw-system-prompt.md` 존재 | `[ -f docs/seabw-system-prompt.md ]` |
| 12 | `apps/web/src/lib/{hq-api,tendency-prompt,sign-loop}.ts` 존재 | 3개 파일 존재 |
| 13 | `apps/web/src/components/chat.tsx` (또는 동급) 존재하고 HQ `/agent/chat` SSE 호출 | grep `EventSource\|/agent/chat` |
| 14 | Survey 완료 후 chat 진입 시 첫 user message에 tendency markdown이 포함됨 | dev 환경 manual: network tab |
| 15 | wagmi 서명 한 사이클이 동작 (build-step → 서명 → step-complete) | dev 환경 manual smoke |

## 기본 검증

- [ ] `pnpm typecheck` exit 0
- [ ] `pnpm lint` exit 0
- [ ] `pnpm -r build` exit 0
- [ ] `pnpm dev:server` 부팅 OK (empty placeholder OK)
- [ ] `pnpm dev:web` 부팅 OK + `/` 200
- [ ] HQ apps/server 부팅 OK + `/agent/chat` 응답
- [ ] CLAUDE.md / PROGRESS.md 페이즈 정보 갱신
- [ ] `pnpm-lock.yaml` 변경이 v1.1.0 범위와 일치 (defi-cli 관련 dep 감소, 신규 dep 없음 또는 최소)

## 엣지케이스 (상위 3개)

| # | 시나리오 | 기대 동작 |
|---|---------|----------|
| E1 | HQ apps/server가 꺼진 상태에서 chat 진입 | seabw web이 "HQ 서버 연결 실패" 에러 표시 (alert/toast), 앱 죽지 않음 |
| E2 | `AGENT_SYSTEM_PROMPT_FILE` 미설정 또는 파일 없음 | HQ가 default system prompt 사용 (fallback) — seabw가 명시적 경고 로그 |
| E3 | 사용자 wagmi 서명 거절 | seabw web이 chat에 "서명을 거부했어요. 진행을 중단합니다." 메시지 전송, `/pipeline/step-complete` 미호출, 세션 자연 만료 |

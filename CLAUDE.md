# seabw (DefiPilot)

DefiPilot — KOFIA 기반 설문으로 투자자 성향을 진단하고, HypurrQuant 백본에 얹은 AI 어드바이저와 대화하며 LP 추천부터 wagmi 서명까지 잇는 시스템.

## 현재 페이즈

- **버전**: v1.2.1 (scope 확장 — 2차)
- **기능**: 1차 Wallet SIWE Auth (✅ 완료) + 2차 **AI Tool Loop** — HQ `@hq/react/agent` 재사용 + 21개 HQ tool 핸들러 이식 + `propose_lp_positions` 신규 + LP 카드 3장 UI + compose_pipeline 흐름 + wagmi 서명
- **상태**: ✅ 완료 (Step 5A 구현 완료, Step 5B 최종 게이트 대기)
- **문서**: [docs/phases/v1.2.1-wallet-siwe-auth/](docs/phases/v1.2.1-wallet-siwe-auth/)
- **Codex Session ID**: `/Users/mousebook/Documents/hypurrquant/seabw/docs/phases/v1.2.1-wallet-siwe-auth`
- **데모**: 2026-05-21
- **시작일**: 2026-05-20
- **완료일**: 2026-05-20

## 이전 페이즈

- **v1.2.0** — Chat + Report split-screen (좌: report, 우: AI chat) + HQ `/agent/chat` SSE wiring + investor profile 주입. 2026-05-20 완료. [문서](docs/phases/v1.2.0-chat-and-report-split/)
- **v1.1.1** — domain-oriented 폴더 리팩토링 (`apps/web/src/{domains,components,lib,state,app}/`). 2026-05-20 완료. [문서](docs/phases/v1.1.1-domain-refactor/)
- **v1.1.0** — HQ backbone 채택 + apps/server·core 삭제 + seabw 슬림화 + defi-cli 폐기. 2026-05-20 완료. [문서](docs/phases/v1.1.0-hq-backbone/)
- **v1.0.1** — v1.0.0 controller 이전 과정의 회귀 8건 + 추가 2건 패치. 2026-05-20 완료. [문서](docs/phases/v1.0.1-regression-fixes/)
- **v1.0.0** — pnpm 모노레포 + NestJS 서버 + Codex agent (Anthropic SDK 제거). 2026-05-20 완료. [문서](docs/phases/v1.0.0-monorepo-codex/)

## 구조

```
apps/web/src/
├─ app/                              # Next.js 라우팅 (얇음)
│  ├─ layout.tsx, page.tsx, error.tsx, globals.css
├─ domains/
│  ├─ landing/landing.tsx
│  ├─ survey/{survey,tier-result,lib}.{tsx,ts}
│  ├─ wallet/{connect-wallet-panel,connect-wallet-stage,connect-wallet-modal,wallet-modal-context}.tsx
│  ├─ auth/{use-siwe-auth,hq-client-provider}.{ts,tsx}   # v1.2.1
│  ├─ chat/{chat,lp-cards,pipeline-ready-card}.tsx  # v1.2.1 AI Tool Loop UI
│  ├─ agent/{providers,runtime,store,tools}/         # v1.2.1 HQ agent/tool runtime
│  └─ portfolio/                     # 후속 phase 자리만 확보
├─ components/{ui,providers,site-header,demo-banner}.tsx   # 공유 UI
├─ lib/{wagmi,chains,utils}.ts                              # 공유 인프라
└─ state/app-state.tsx
src/                                  # 휴면(보존) — phase 시작 시점 그대로
docs/phases/
  v1.0.0-monorepo-codex/        # 완료
  v1.0.1-regression-fixes/      # 완료
  v1.1.0-hq-backbone/           # 완료 — apps/server·core 통째 삭제, HQ backbone 채택
  v1.1.1-domain-refactor/       # 완료 — domain-oriented 폴더로 재배치
  v1.2.0-chat-and-report-split/ # 완료 — split-screen + HQ chat
  v1.2.1-wallet-siwe-auth/      # 완료 — SIWE + AI Tool Loop
```

v1.1.0에서 `apps/server`, `apps/core`는 통째로 제거됐고 모든 책임은 외부 HypurrQuant apps/server가 가져간다.
seabw web은 survey + tendency 변환 + HQ chat 호출 + wagmi 서명만 담당.

## 부팅

```bash
# 1) seabw web 부팅
pnpm install
cp apps/web/.env.local.example apps/web/.env.local
# apps/web/.env.local:
# NEXT_PUBLIC_HQ_ORIGIN=http://localhost:3003
# NEXT_PUBLIC_HQ_BASE_URL=http://localhost:3003/api/v1
pnpm dev                      # apps/web only, http://localhost:3000

# 2) HypurrQuant backbone — Docker compose (권장)
cd /Users/mousebook/Documents/side-project/HypurrQuant_FE/worktrees/seabw-integration/apps/server
docker start mongo hypurrquant-server-redis-1   # 기존 인프라 컨테이너 재기동
docker compose -f docker-compose.local.yml up -d --build api
# → hq-api on http://localhost:3003 (route prefix /api/v1)
# → AGENT_SYSTEM_PROMPT_FILE 은 .env.local + compose volume 으로 자동 주입
# → AGENT_AUTH_DEV_BYPASS 는 v1.2.1 부터 사용 안 함 (SIWE 필수)
```

`apps/web/.env.local` 의 `NEXT_PUBLIC_HQ_ORIGIN=http://localhost:3003` 와 `NEXT_PUBLIC_HQ_BASE_URL=http://localhost:3003/api/v1` 사용.

## Codex (acpx) 사전 조건

HQ apps/server의 `/agent/chat` SSE 는 `acpx` + `codex-acp` 가 HQ 측 PATH 에 있어야 동작.
seabw web은 HQ에 HTTP/SSE로만 의존하므로 seabw 측에서는 codex 직접 호출 없음.

## 해커톤 운영 정책

- **이번 해커톤은 전부 로컬 실행 기준**으로 진행한다. 배포/CI/도커는 scope 외.
- seabw web + HQ apps/server를 같은 머신에서 dev 모드로 띄워 사용한다.
- env, 포트, 의존성 가정은 전부 "로컬 dev" 전제. 운영 보안/스케일 항목은 의도적 미적용.

## HypurrQuant_FE (HQ) 패치 — 전용 worktree

HQ는 별 프로젝트이며 다른 작업이 동시에 진행 중이라, seabw 통합용 HQ 수정은 **반드시 전용 worktree에서만** 수행한다.

- **Worktree 경로**: `/Users/mousebook/Documents/side-project/HypurrQuant_FE/worktrees/seabw-integration`
- **브랜치**: `feat/seabw-integration` (`origin/main` 추적)
- **HQ 메인 워크트리**: `/Users/mousebook/Documents/side-project/HypurrQuant_FE` (현재 `develop` 브랜치) — 직접 수정 금지
- 커밋 메시지 prefix 권장: `[seabw]` — 추후 develop/master에 cherry-pick·merge 시 식별 용이

## 검증

```bash
pnpm typecheck               # apps/web strict tsc
pnpm build                   # next build
pnpm test                    # vitest
```

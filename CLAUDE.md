# seabw (DefiPilot)

DefiPilot — KOFIA 기반 설문으로 투자자 성향을 진단하고, HypurrQuant 백본에 얹은 AI 어드바이저와 대화하며 LP 추천부터 wagmi 서명까지 잇는 시스템.

## 현재 페이즈

- **버전**: v1.2.1
- **기능**: Wallet SIWE Auth — wagmi + HQ SIWE(`/agent/auth/challenge`·`/verify`) → JWT 토큰 attach, dev-bypass 제거, landing 직후 wallet stage + 상단 wallet 헤더 + connect 모달
- **상태**: Step 1 - PRD
- **문서**: [docs/phases/v1.2.1-wallet-siwe-auth/](docs/phases/v1.2.1-wallet-siwe-auth/)
- **시작일**: 2026-05-20

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
│  ├─ wallet/connect-wallet.tsx
│  ├─ chat/chat.tsx                  # placeholder (v1.2.0 구현)
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
  v1.2.0-chat-and-report-split/ # 진행중 — split-screen + HQ chat + wagmi sign loop
```

v1.1.0에서 `apps/server`, `apps/core`는 통째로 제거됐고 모든 책임은 외부 HypurrQuant apps/server가 가져간다.
seabw web은 survey + tendency 변환 + HQ chat 호출 + wagmi 서명만 담당.

## 부팅

```bash
# 1) seabw web 부팅
pnpm install
cp apps/web/.env.local.example apps/web/.env.local
pnpm dev                      # apps/web only, http://localhost:3000

# 2) HypurrQuant backbone (별 터미널)
cd /Users/mousebook/Documents/side-project/HypurrQuant_FE/worktrees/seabw-integration
# 최초 1회: pnpm install (+ wasm-crypto pkg/ 생성)
AGENT_STORAGE_MODE=none \
AGENT_AUTH_DEV_BYPASS=1 \
AGENT_AUTH_DEV_WALLET=0x0000000000000000000000000000000000000abc \
AGENT_SYSTEM_PROMPT_FILE=/Users/mousebook/Documents/hypurrquant/seabw/docs/seabw-system-prompt.md \
  pnpm dev:server             # HQ NestJS — chat + pipeline + MCP, http://localhost:3001
```

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

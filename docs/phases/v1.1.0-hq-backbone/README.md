# HQ backbone 채택 + seabw 슬림화 - v1.1.0

## 문제 정의

### 현상
- 이전 v1.1.0 plan은 HQ(`/Users/mousebook/Documents/side-project/HypurrQuant_FE`)의 LP read/write/pipeline/MCP를 seabw로 **vendor copy**하는 11-step 대공사였다.
- 다시 들여다보니 그 작업의 80%가 "HQ에 이미 완성된 코드를 옮겨와서 똑같이 다시 만드는" 일이다.
- seabw가 가진 **고유 자산은 설문(survey) + 투자자 tendency 분석 + 추천 narrative/브랜딩** 뿐. DeFi read/write/AI/MCP는 전부 HQ에 있다.
- v1.0.0이 만든 codex agent 도메인도 사실상 HQ의 동일 자산과 중복.

### 목표
**HQ apps/server를 backbone으로 그대로 운영**하고, **seabw는 설문 + 페르소나 + UI 컨테이너** 역할만 한다.

1. HQ apps/server를 로컬에서 정상 부팅할 수 있어야 함 (env, 의존성, 부팅 가이드).
2. HQ에 `AGENT_SYSTEM_PROMPT_FILE` env hook을 추가해 seabw 페르소나 주입 가능.
3. seabw web의 chat이 HQ `/agent/chat` (SSE)를 호출하고, 첫 user message에 설문 결과(tendency markdown)를 자동으로 포함.
4. HQ `/pipeline/build-step` 응답 calldata를 seabw web의 wagmi가 서명하고, `/pipeline/step-complete`로 보고하는 1회 루프가 데모에서 동작.
5. defi-cli와 seabw의 옛 DeFi 도메인(`plan/marketplace/portfolio/precheck`)은 v1.1.0 종료 시점에 제거 또는 휴면.

### 비목표
- ❌ HQ 코드 vendor copy (이전 plan 폐기)
- ❌ `@hq/react`/`@hq/core` workspace 참조 셋업 — **v1.2.0+에서 portfolio/풀 브라우저 UI 만들 때 추가**
- ❌ User position 표시 UI — v1.2.0+
- ❌ wasm-crypto 실 구현 (해커톤 = 평문 가정)
- ❌ Docker / CI / staging 배포 — **해커톤 = 로컬 전용**
- ❌ HQ 다른 앱(landing, miniapp-* 등)과 함께 띄우기 — 단일 HQ server 인스턴스만
- ❌ 다중 사용자 / 세션 영속화 / 인증 강화
- ❌ Lending / Perp — HQ가 가지지만 seabw 페르소나에서는 LP만 노출

### 제약사항
- **로컬 전용**: 모든 가정은 dev 모드, 동일 머신.
- **HQ는 별 프로젝트**: 패치는 worktree `feat/seabw-integration`에서만. develop/master 직접 수정 금지.
- **user-custody 유지**: 서명은 seabw web의 wagmi가, HQ server는 calldata만 반환.
- **HQ의 chat / pipeline / MCP 동작은 그대로 사용** — codex CLI, acpx, MCP tool은 HQ가 운영.
- **seabw apps/server는 슬림화**: 옛 DeFi 도메인 4개 + `defi-cli.ts` + `agent/` 도메인 모두 폐기 대상.

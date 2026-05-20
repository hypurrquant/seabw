# seabw

DeFi robo-advisor — 자연어 목표를 받아 티어/체인/화이트리스트 기반 파이프라인 플랜으로 변환하고, defi-cli로 calldata를 hydrate한 뒤 사용자가 서명·실행하는 시스템.

## 현재 페이즈

- **버전**: v1.1.0
- **기능**: HypurrQuant LP read+write+pipeline+AI execution 이식 + defi-cli 폐기
- **상태**: Step 1 — PRD
- **문서**: [docs/phases/v1.1.0-hq-lp-pipeline/](docs/phases/v1.1.0-hq-lp-pipeline/)
- **시작일**: 2026-05-20

## 이전 페이즈

- **v1.0.1** — v1.0.0 controller 이전 과정의 회귀 8건 + 추가 2건 패치 (실패 audit log, retry-after 헤더, intent abort wiring, validation envelope 원형, rehydrate schema parse, portfolio 502). codex 재검증 OK. 2026-05-20 완료. [문서](docs/phases/v1.0.1-regression-fixes/)
- **v1.0.0** — pnpm 모노레포 + NestJS 서버 + Codex agent (Anthropic SDK 제거). 2026-05-20 완료. [문서](docs/phases/v1.0.0-monorepo-codex/)

## 구조

```
apps/
  core/          # @seabw/core — API 경계 타입 SSOT (types, schemas, config, http DTOs)
  server/        # @seabw/server — NestJS 11 + 4 도메인(plan/marketplace/precheck/portfolio) + agent
  web/           # @seabw/web — Next.js 15 UI only (API Route 없음)
src/             # 휴면(보존) — phase 시작 시점 그대로
docs/phases/
  v1.0.0-monorepo-codex/        # 완료 — 모노레포 + NestJS + Codex agent
  v1.0.1-regression-fixes/      # 완료 — v1.0.0 회귀 패치
  v1.1.0-hq-lp-pipeline/        # 진행중 — HQ LP read+write+pipeline+AI 이식 + defi-cli 폐기
```

## 부팅

```bash
# 한 번만
pnpm install
cp apps/web/.env.local.example apps/web/.env.local

# 두 워크스페이스 동시 실행
pnpm dev:server  # http://localhost:4000
pnpm dev:web     # http://localhost:3000
```

## Codex (acpx) 사전 조건

`/agent/chat` SSE 와 intent 파싱은 `acpx` + `codex-acp` 가 로컬 PATH 에 있어야 동작.
미설치 시 server는 정상 부팅되지만 `AgentLLMPort.chat()` 가 error 이벤트로 종료하고
IntentService 는 휴리스틱 fallback 으로 정상 결과를 반환.

## 검증

```bash
bash scripts/verify-dod.sh   # DoD grep 자동 검증
pnpm typecheck               # 모든 워크스페이스 strict tsc
pnpm -r test                 # vitest 통합 실행
```

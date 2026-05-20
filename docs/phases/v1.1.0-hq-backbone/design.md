# 설계 - v1.1.0

## 접근법

**HQ apps/server를 backbone으로 그대로 운영 + seabw는 얇은 레이어**.

핵심 결정 5개:

1. **HQ 코드 import 0** — seabw apps/web/server는 HQ의 `@hq/*` 패키지를 직접 import하지 않는다. HTTP/SSE만으로 통신. (v1.2.0에서 portfolio UI 만들 때 `@hq/react` 참조 도입)
2. **HQ 1줄 패치**: `AGENT_SYSTEM_PROMPT_FILE` env로 system prompt 갈아끼우기 (HQ worktree `feat/seabw-integration`)
3. **seabw apps/server 슬림화** — 옛 DeFi 도메인(plan/marketplace/portfolio/precheck) + codex agent 도메인 + defi-cli **통째 삭제**. seabw 서버는 사실상 placeholder.
4. **seabw apps/web 슬림화** — 옛 multi-stage 흐름(intent/basket/marketplace/plan-review/portfolio/risks) 제거. 살아남는 흐름: **landing → survey → tier-result → chat → wagmi sign loop**.
5. **HQ ↔ seabw 데이터 흐름**:
   - chat: seabw web → `POST /agent/chat` (SSE) on HQ
   - 첫 user message에 tendency markdown 자동 포함
   - 서명 루프: seabw web wagmi가 HQ `/pipeline/build-step` 응답 calldata 받아 서명 → `/pipeline/step-complete`

## 버린 대안

- **A. vendor copy 전체 (이전 plan)** — HQ에 이미 있는 코드를 똑같이 복사·rebrand. 작업량 5배. 폐기.
- **B. Workspace symlink (HQ를 pnpm-workspace에 추가)** — 빌드 통합/타입 안전성은 좋지만 두 모노레포가 사실상 합쳐져 의존 폭발. 해커톤 비용 초과.
- **C. defi-cli 유지 + HQ 병행** — defi-cli 자체가 v1.1.0의 폐기 대상. 의미 없음.
- **D. seabw apps/server에 HQ proxy 레이어 추가** — 단순 proxy가 layer를 늘릴 뿐. seabw web이 HQ를 직접 호출하는 게 더 단순.

## 디렉토리 변경 후 모양

```
seabw/
├─ apps/
│  ├─ core/                              # 슬림화 — generic 타입/유틸만
│  │  ├─ http/{api-response,dto,index}.ts (유지/정리)
│  │  ├─ config/chains.ts                (wagmi에 필요 — 유지)
│  │  ├─ lib/tiers.ts                    (생존 시 유지)
│  │  └─ types/index.ts                  (정리)
│  ├─ server/                            # placeholder (보안/세션 향후 위해 골격만)
│  │  ├─ src/
│  │  │  ├─ app.module.ts                (빈 imports)
│  │  │  ├─ bootstrap/main.ts            (유지)
│  │  │  ├─ common/                      (유지)
│  │  │  └─ lib/ratelimit.ts             (유지 — 향후 활용 가능)
│  │  └─ package.json                    (defi-cli 의존성 제거)
│  └─ web/
│     └─ src/
│        ├─ app/{layout,page,error}.tsx + globals.css   (유지)
│        ├─ components/
│        │  ├─ survey.tsx                (유지 — 핵심)
│        │  ├─ tier-result.tsx           (유지 — 설문 결과 표시)
│        │  ├─ connect-wallet.tsx        (유지)
│        │  ├─ site-header.tsx           (유지)
│        │  ├─ providers.tsx             (유지)
│        │  ├─ ui.tsx                    (유지)
│        │  └─ chat.tsx                  (신규)
│        ├─ lib/
│        │  ├─ wagmi.ts                  (유지)
│        │  ├─ utils.ts                  (유지)
│        │  ├─ hq-api.ts                 (신규 — HQ client + SSE)
│        │  ├─ tendency-prompt.ts        (신규 — survey → markdown)
│        │  └─ sign-loop.ts              (신규 — build-step ↔ wagmi ↔ step-complete)
│        └─ state/app-state.tsx          (slim — survey/tier/chat 단계만)
└─ docs/seabw-system-prompt.md           (신규 — HQ에 주입할 페르소나)
```

**삭제 대상 (요약)**:

- 서버: `apps/server/src/domains/{plan,marketplace,portfolio,precheck,agent}/`, `apps/server/src/lib/defi-cli.ts`, `apps/server/src/lib/__tests__/`, `apps/server/src/__tests__/mainnet-staticcall.test.ts`
- 코어: `apps/core/types/{yield-product,portfolio}.ts`, `apps/core/schemas/` 의 defi-cli 관련 부분
- 웹 컴포넌트: `basket-bar.tsx`, `basket-review.tsx`, `dag-node.tsx`, `intent-input.tsx`, `marketplace.tsx`, `plan-review.tsx`, `portfolio-summary.tsx`, `product-detail.tsx`, `sign-flow.tsx`, `stage-indicator.tsx`, `demo-banner.tsx`, `landing.tsx`(또는 단순 페이지로 축소)
- 웹 페이지: `apps/web/src/app/portfolio/`, `apps/web/src/app/risks/`
- 웹 lib: `guardrail-labels.ts`
- 테스트/e2e: 위 도메인 의존 spec/playwright 시나리오 함께 정리

## HQ 측 변경 (worktree `feat/seabw-integration`)

`apps/server/src/domains/agent/application/system-prompt.service.ts` (또는 동등 위치):

```ts
function getSystemPrompt(): string {
  const path = process.env.AGENT_SYSTEM_PROMPT_FILE;
  if (path) {
    try { return fs.readFileSync(path, 'utf8'); }
    catch { /* fall through to inline env */ }
  }
  return process.env.AGENT_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT;
}
```

seabw 운영 시:
```bash
AGENT_SYSTEM_PROMPT_FILE=/Users/.../seabw/docs/seabw-system-prompt.md
```

## 데이터 흐름 (v1.1.0 완료 시점 기준)

```
[seabw web]
  landing → survey → tier-result
              ↓
          tendency markdown 생성 (lib/tendency-prompt.ts)
              ↓
          chat 화면 진입
              ↓
          첫 user message로 tendency 자동 발송
              ↓
      POST /agent/chat (SSE) ──→ [HQ apps/server]
                                        ↓
                                  codex(acpx) + MCP
                                        ↓
                                  (LP 데이터 조회 / 추천 / 사용자 확인)
                                        ↓
                                  /pipeline/resolve
                                  ←── sessionId, firstStep
                                  
  사용자 [서명] 클릭
        ↓
  POST /pipeline/build-step → calldata 수신
        ↓
  wagmi.useSendTransaction → 사용자 서명 → txHash
        ↓
  POST /pipeline/step-complete → done=false면 다음 step 루프, done=true면 종료
```

## 기술 결정 보강

- **SSE 클라이언트**: seabw web에서 `fetch` + `ReadableStream` (Next.js 15 호환). 라이브러리 무도입.
- **상태 관리**: 기존 `app-state.tsx` 의 reducer 그대로 활용, stage enum만 축소.
- **env**:
  - `NEXT_PUBLIC_HQ_BASE_URL=http://localhost:3000` (HQ apps/server 포트)
  - `AGENT_SYSTEM_PROMPT_FILE` (HQ 운영 환경 변수, seabw repo 경로 가리킴)
- **CORS**: HQ apps/server에서 seabw web origin(`http://localhost:3000` 등)을 허용. HQ의 CORS 설정이 wildcard나 dev 모드라면 무작업, 아니면 worktree 패치.

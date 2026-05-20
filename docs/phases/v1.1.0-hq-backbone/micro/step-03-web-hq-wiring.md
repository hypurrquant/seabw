# Step 03: apps/web 슬림 + HQ wiring

## 메타데이터
- **난이도**: 🟠 중간
- **선행 조건**: Step 01

## 구현 내용

seabw web을 새 흐름에 맞춰 재구성:

### A. 상태기계 슬림화
- `apps/web/src/state/app-state.tsx`
  - Stage union 축소: `landing | survey | tier-result | connect-wallet | chat`
  - 옛 stage(`intent`, `marketplace`, `basket-review`, `plan-review`, `execution`, `portfolio`) 제거
  - `Mode` 제거 (robo/marketplace 구분 불필요)
  - `BasketLine` 등 옛 도메인 타입 제거

### B. 신규 lib 모듈

**`apps/web/src/lib/tendency-prompt.ts`**
- 입력: survey answers
- 출력: markdown 문자열
```ts
export function buildTendencyPrompt(answers: SurveyAnswers): string {
  return `## 투자자 성향 분석 결과
- 위험 선호: ${answers.risk}
- 선호 자산: ${answers.preferredAsset}
- ...

위 결과를 바탕으로 저에게 맞는 LP 풀을 추천해주세요.`;
}
```

**`apps/web/src/lib/hq-api.ts`**
- HQ base URL: `process.env.NEXT_PUBLIC_HQ_BASE_URL ?? 'http://localhost:3000'`
- `chatStream(messages, abortSignal)` — SSE 클라이언트
  - `fetch('/agent/chat')` + `body.getReader()` 로 chunk 파싱
  - 이벤트 type별 (`message`, `tool_call`, `tool_result`, `done`, `error`) emitter
- `pipelineBuildStep({sessionId, stepIndex})` → calldata
- `pipelineStepComplete({sessionId, stepIndex, txHash, receiptStatus})` → next or done

**`apps/web/src/lib/sign-loop.ts`**
- `runSignLoop({sessionId, onStep, signTx})`
  - 반복: build-step → signTx (wagmi) → step-complete
  - signTx는 wagmi의 `useSendTransaction` 래퍼
  - done 되면 종료, 거절·revert 처리

### C. 신규 컴포넌트
**`apps/web/src/components/chat.tsx`**
- ChatMessage[] 상태
- 첫 진입 시 tendency markdown을 첫 user message로 자동 발송
- `chatStream` 이벤트로 messages 갱신
- 서명 요청 이벤트 감지 시 `runSignLoop` 발동
- `<Chat />` 한 컴포넌트로 정리

### D. 기존 컴포넌트 갱신
- `apps/web/src/app/page.tsx` — Stage에 따라 survey/tier/chat 렌더
- `apps/web/src/app/layout.tsx` — providers + site-header만
- `apps/web/src/components/site-header.tsx` — 불필요한 링크 제거
- `apps/web/src/components/landing.tsx` — defi-cli 의존 제거 후 단순 hero 페이지로 (또는 page.tsx에 인라인)
- `apps/web/src/components/connect-wallet.tsx` — 그대로
- `apps/web/src/components/survey.tsx` — 완료 시 `buildTendencyPrompt` 호출 + 다음 stage 이동
- `apps/web/src/components/tier-result.tsx` — 결과 표시 후 chat 진입 버튼

### E. env
- `apps/web/.env.local.example` 갱신
  - 제거: 옛 DeFi env
  - 추가: `NEXT_PUBLIC_HQ_BASE_URL=http://localhost:3000`

## 완료 조건
- [ ] DoD 9 충족: `pnpm -F @seabw/web build` exit 0
- [ ] DoD 12 충족: `apps/web/src/lib/{hq-api,tendency-prompt,sign-loop}.ts` 존재
- [ ] DoD 13 충족: chat.tsx가 `/agent/chat` SSE 호출 (`rg "/agent/chat" apps/web` hit)
- [ ] DoD 14 충족: survey → chat 진입 시 첫 user message에 tendency markdown 포함 (manual)
- [ ] DoD 15 충족: build-step → wagmi 서명 → step-complete 1 cycle 동작 (manual smoke)
- [ ] `pnpm dev:web` 부팅 + `/` 200

## Scope

### 수정
- `apps/web/src/state/app-state.tsx`
- `apps/web/src/app/{layout,page}.tsx`
- `apps/web/src/components/{site-header,landing,survey,tier-result}.tsx`
- `apps/web/.env.local.example`
- `apps/web/package.json` (필요 시 deps 정리)

### 신규
- `apps/web/src/lib/{hq-api,tendency-prompt,sign-loop}.ts`
- `apps/web/src/components/chat.tsx`

### 삭제 (Step 01에서 한 것 외 추가)
- 빌드 실패 원인이 되는 미사용 import 정리

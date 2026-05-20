# Chat + Report Split-screen - v1.2.0

## 문제 정의

### 현상
- v1.1.0/v1.1.1 시점, chat 페이지는 placeholder만 존재. HQ apps/server의 `/agent/chat` (SSE)와 실제로 연결되지 않음.
- 설문 결과(`Answers` + `TierResult`)가 LLM에 도달하지 않음. HQ system prompt가 "tier-aware" 라고 명시하지만 데이터는 안 들어감 → [docs/handover/ai-investor-profile-spec.md](../../handover/ai-investor-profile-spec.md) 참조.
- 현재 흐름은 단일 페이지 직선: landing → survey → tier-result → connect-wallet → chat. 사용자가 chat에 들어가면 report(tier-result)는 더 이상 보지 않음 → 추천 대화의 근거가 시야에서 사라짐.

### 원인
- 직선형 stage 진행이 "report 참조하며 대화" 라는 사용 의도와 어긋남.
- v1.1.x 까지는 HQ wiring을 의도적으로 deferred.

### 영향
- AI가 사용자 성향 모르고 일반 답변 → 추천 정확도 ↓
- 사용자가 chat 중 자기 성향/등급을 다시 확인하려면 뒤로가기 필요 → UX 단절
- 실제 트랜잭션 실행 경로 부재 → 데모 시 "AI 대화는 되지만 실행은 안 됨" 상태

### 목표
1. **Split-screen 레이아웃**: chat stage 진입 시 화면을 좌/우로 분할.
   - 좌: 기존 `TierResultView` (report) **그대로** 표시
   - 우: AI chat 패널 (HQ `/agent/chat` SSE)
2. **Investor profile 전달**: chat 진입 시점에 HQ 세션을 생성하면서 `{ answers, tier }` 를 함께 전송. HQ는 system prompt에 inject.
3. **HQ 패치 (worktree `feat/seabw-integration`)**
   - `POST /agent/sessions` body에 `profile?: InvestorProfile` 수용
   - `AgentSession` 도메인 타입에 `profile?` 보관
   - `AgentChatService.handleMessage` 시스템 프롬프트 앞에 profile JSON 블록 prepend (있을 때)
   - **별개**: `AGENT_SYSTEM_PROMPT_FILE` env → 파일 경로 지정 시 기본 시스템 프롬프트 override (DefiPilot 페르소나용)
4. **seabw web 구현**
   - `lib/hq-api.ts` — `createSession(profile?)`, `chatStream(sessionId, message)` SSE
   - `lib/tendency-prompt.ts` — survey 결과 → 첫 user message용 markdown (선택, profile이 session에 박혔으므로 보조용)
   - `domains/chat/chat.tsx` — 실제 chat UI (메시지 리스트 + 입력)
   - `app/page.tsx` chat stage 라우팅 — split-screen layout
5. **DefiPilot 페르소나 파일**: `docs/seabw-system-prompt.md` 작성 → HQ env로 주입

### 비목표 (Out of Scope)
- ❌ **HQ tool 실행 경로** (`tool_call` SSE 이벤트 → browser 실행 → POST `/agent/tool-result`) — 본 phase는 tool 호출 시 placeholder 응답으로 stub. 실제 tool 실행은 v1.3.0+
- ❌ **HQ auth 구현** — `AgentAuthGuard` 가 요구하는 SIWE-style 인증을 정식 구현하지 않음. HQ worktree에서 dev 모드 bypass env 추가 (`AGENT_AUTH_DEV_BYPASS=1`)
- ❌ **세션 영속화** — HQ가 Mongo session adapter 있으나 본 phase에서는 in-memory로 충분
- ❌ **세션 히스토리 UI** — 세션 목록/삭제 UI 신규 작성 안 함
- ❌ **wagmi sign loop (build-step ↔ step-complete)** — pipeline 실행은 tool 흐름의 일부라 v1.3.0
- ❌ **portfolio 도메인 구현** — 후속 phase
- ❌ **Codex 미설치 시 fallback UX 디테일** — 에러 메시지만 표시
- ❌ **사용자 메시지 로컬 저장** — HQ 측에서 처리

## 제약사항

### 기술적 제약
- HQ는 별 프로젝트. 모든 수정은 worktree `feat/seabw-integration` 에서만.
- HQ chat은 SSE. seabw web은 native `fetch` + `ReadableStream`로 consume.
- profile에 **지갑 정보 포함 금지** (spec 명시). `Answers` + `TierResult` 만 보낸다.
- seabw 브랜드명은 **DefiPilot** 유지.
- 본 phase는 단일 PR 1회 cutover. dual-write 없음.

### 비즈니스 제약
- 해커톤 = 로컬 전용. 데모 환경에서 HQ 서버 + seabw web 동시 부팅.

### 시간 제약
- 단일 phase로 마감.

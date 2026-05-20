# LP 추천 카드 모달 - v1.3.0

> 전제: **v1.2.1 2차 (AI Tool Loop) 완료** — `@hq/react/agent` workspace link, BrowserToolRegistry, HQ 26개 tool 핸들러 이식, `usePipelineStore` + `PipelinePreviewModal` + `executeRecipe` + wagmi 서명 흐름이 모두 가동된 상태를 가정한다.

## 문제 정의

### 현상
- v1.2.1 2차 완료 시점 기준, AI 는 chat 으로 LP 추천을 자유 형식 텍스트로만 답한다.
  - 사용자가 "내 성향에 맞는 LP 알려줘" 라고 물어도 AI 가 1개 / 2개 / 5개 / 산문 형식 등 매번 다른 모양으로 응답.
  - 사용자가 응답에서 풀을 인지 → 별도 행동 (`/pipeline/resolve` 트리거할 길) 없음.
- `compose_pipeline` 흐름이 가동되어 있어도, **사용자가 어떤 풀을 어떤 파라미터로 진입할지를 자연어 → tool args 로 정확히 옮길 결정점이 부재**.
- 결과: "AI 가 추천했다 → 사용자가 선택했다 → 온체인 진입" 의 종단 시연 경로가 여전히 절반.

### 원인
- HQ 의 기존 tool 26개는 "데이터 조회/실행" 중심. **"사용자에게 N 개 선택지를 제시"** 의도를 가진 tool 이 부재.
- DefiPilot system prompt 가 자유 응답을 권장 — LP 제시 구조에 대한 출력 규약 없음.
- 카드 → 실행 연결고리(`recipe: RecipeAtom[]`) 가 자연어 응답에 박힐 수 없음 — 구조화 tool 호출만이 신뢰 가능.

### 영향
- 데모: AI 응답에서 풀을 골라도 사용자가 "다음" 으로 못 감 → 인터랙티브 데모 불가.
- 안전성: 자연어 추천은 tier 한도(예: preservation 에 degen 풀 권유)를 LLM 이 우회할 여지 — 구조화 카드면 zod 검증으로 차단 가능.
- 향후 portfolio / multi-step 시연도 동일한 "AI 가 N 개 옵션 제시" 패턴을 재사용하므로, 카드형 UX 를 일반화한 첫 사례가 본 phase.

### 목표
1. **`propose_lp_positions` (27번째 tool) 신규** — HQ MCP 스키마 + seabw 브라우저 핸들러. args 는 정확히 3 개 카드 (`LpCard` 표준).
2. **`LpCard` / `LpProposal` zod 스키마 확정** — 식별, pool, 정량지표, 포지션 파라미터, AI 설명, 실행 페이로드(`recipe`).
3. **`<LpProposalModal/>` UI** — 화면 중앙 모달. AI 가 `propose_lp_positions` 호출 시 자동 오픈.
   - 카드 3장 가로/세로 정렬, rank 1 (최고 추천) 강조.
   - 카드별 KPI bar, pros/cons, tier alignment 배지.
   - 모달 닫기 = "추천 보류" 의 의미.
4. **카드 클릭 → 실행 트리거 (AI 매개)**
   - 카드 클릭 → 모달 닫힘 → seabw 가 `I choose option <N>` 형태의 user 메시지를 chat 으로 자동 재전송.
   - AI 가 해당 카드의 `recipe` 를 인지하고 `compose_pipeline` tool_call 발행 → 기존 `PipelinePreviewModal` 흐름 진입 → wagmi 서명.
5. **카드 잔존 정책** — 사용자가 새 메시지 입력 시 `useLpProposalStore.clear()` → 모달 즉시 제거.
6. **DefiPilot system prompt 갱신** — LP 추천 시 반드시 `propose_lp_positions` 사용, 정확히 3장, rank 1 = 최고 추천, tier 한도 가드.

### 비목표 (Out of Scope)
- ❌ HQ 26 개 tool 자체 / `@hq/react/agent` 패키지 수정 (v1.2.1 2차 산출물 그대로 사용).
- ❌ `BrowserToolRegistry` / `usePipelineStore` / `PipelinePreviewModal` / `executeRecipe` 인프라 (v1.2.1 2차).
- ❌ HQ 측 신규 endpoint — 기존 `/pipeline/resolve` 그대로.
- ❌ 카드 4 장 이상 / "추가 추천" 버튼 / 카드 갱신 요청 UI.
- ❌ 카드 비교 뷰 (side-by-side 비교 모드).
- ❌ 슬리피지 / 가스 / range 의 사용자 직접 조정 — AI 가 정한 값 그대로.
- ❌ 다중 카드 동시 실행.
- ❌ 카드 잔존 + 선택 병행 (`유지 + 선택 여전히 가능`) 옵션 — 새 메시지 = clear 로 단순화.
- ❌ 실행 결과(포지션 변화)를 AI 에게 자동 피드백.
- ❌ tier 가드의 백엔드 강제 — system prompt 만으로 (zod schema 가 형식만 검증).
- ❌ 포트폴리오 모니터링 (`domains/portfolio/`는 v1.4.0+).
- ❌ 카드 UI 의 다국어, dark/light theme 분기 (기본 테마만).
- ❌ E2E 자동화 — 수동 시연 위주.

## 제약사항

### 시간
- 데모 데드라인 (v1.2.1 2차가 2026-05-21 데모 — 본 phase 는 그 이후 첫 후속 phase 로 시점 미정).

### 기술
- HQ MCP 스키마와 seabw zod 스키마의 SSOT 결정 필요 — 양쪽 drift 방지.
- 카드 클릭 → "I choose option N" 재전송이 LLM 결정성에 의존 — system prompt 가이드라인이 약하면 AI 가 다른 답을 할 위험.
- 모달 in `chat` stage 안 — `PipelinePreviewModal` 과 동시 표시 가능성. z-index / 표시 순서 정의 필요.
- 사용자 메시지 자동 발행 시 user-typed 메시지와 시각적으로 구분되어야 함 (또는 동일 처리).

### 비즈니스
- 로컬 데모 한정.
- HQ worktree `feat/seabw-integration` 만 사용. HQ main/develop 영향 금지.
- 본 phase 의 모든 변경은 단일 PR 1 회 cutover. dual-write 없음.

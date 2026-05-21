# Chat URL Route - v1.3.0

## 문제 정의

### 현상
- chat 화면이 URL 없는 stage state (`state.stage === "chat"`)로만 진입 → 새로고침/공유 시 landing부터 다시 시작.
- 설문 완료 후 tier-result CTA를 누르면 `/` URL 그대로에서 화면만 split-screen으로 바뀜.

### 목표
- 설문 완료 후 `/chat?a=<base64>` 로 라우팅. URL에 answers 보존.
- /chat 페이지가 직접 진입(공유/새로고침) 가능. answers 디코딩 → tier 재계산 → split layout (좌: report, 우: chat) 렌더.
- URL 없는 chat stage 제거.

### 비목표
- LLM 응답/세션 ID를 URL에 보존 (이번 phase 아님).
- 다른 stage(landing/survey/tier-result)의 URL 라우팅 (chat만).
- 새로고침 후 HQ 세션 재사용 — 새 세션 새로 생성.

### 제약사항
- 로컬 데모 한정 — 운영 검증/보안 보강 OOS.
- AppState in-memory 유지. URL의 answers가 source of truth.
- v1.2.2의 next.config prod gate / lint 정책 유지.

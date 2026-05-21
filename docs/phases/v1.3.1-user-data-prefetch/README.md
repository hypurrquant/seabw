# User Data Prefetch - v1.3.1

## 문제 정의

### 현상
- v1.3.0 + auth 영속화 작업 후에도 AI 가 `get_enriched_balances` / `get_positions` 호출 시 빈 결과를 받음.
- 원인: seabw 가 부트 시점에 HQ store 를 hydrate 하지 않음 → token list 0개 → balance scan 무의미 → AI 가 "잔액 0" 으로 판단.
- 또한 chat 첫 메시지가 prefetch 끝나기 전에 발사되어 AI 가 데이터 없는 상태에서 분석 시작.

### 목표
- `/chat` 페이지 진입 시 사용자 토큰 잔액 + LP 포지션을 모두 HQ store 에 미리 적재.
- 적재 완료 후에 Chat 컴포넌트를 마운트하고 첫 메시지 발사.
- AI tool 호출 (get_enriched_balances, get_positions 등) 이 항상 prefetched store 에서 즉시 읽음.

### 비목표
- HQ AI agent 흐름 변경 (tool 핸들러는 그대로).
- 자동 refresh polling (HQ 의 PoolStatePollingProvider 같은 거 — 후속).
- 다른 chain 추가 (HyperEVM + Base 만).

### 제약사항
- HQ packages 변경 금지 (worktree).
- AI tool 호출 결과는 store 기반이라 기존 코드 그대로 작동해야 함.

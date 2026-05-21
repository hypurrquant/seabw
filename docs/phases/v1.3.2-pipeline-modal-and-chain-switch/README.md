# Pipeline Execution Modal + Chain Switch - v1.3.2

## 문제 정의

### 현상
1. LP 카드 3장 + Pipeline Ready 카드가 모두 채팅에 inline 으로 표시됨 → AI 가 임의로 compose_pipeline 호출하므로 "사용자가 어느 카드를 선택했는지" flow 없음.
2. Execute 클릭 시 wallet 이 HyperEVM(999) 아닌 다른 체인(예: 102031)에 연결돼있으면 viem 이 `chain mismatch` 에러로 실패.

### 목표
- LP 카드 1개 클릭 → 그 카드의 recipe 로 pipeline 생성 → **모달**로 실행 UI 표시.
- 모달은 HQ `PipelineExecutionModal` 패턴 (idle/executing/complete/error phase) 을 seabw 컬러톤으로.
- Execute 직전 자동 `switchChainAsync({ chainId: 999 })` → 체인 mismatch 자동 복구.

### 비목표
- HQ 의 RecoveryPanel / AppError / ExecutionSummary 풀스택 이식 (seabw 는 간소화 버전).
- compose_pipeline tool 자체 제거 (AI 가 여전히 호출 가능하게 두되, 채팅 inline 카드는 미렌더).
- 멀티체인 지원 (v1.3.1 에서 이미 HyperEVM 단일로 확정).

### 제약사항
- HQ workspace package (`@hq/react/defi/pipeline`, `@hq/react/agent`) 만 의존. apps/web 내부 컴포넌트 직접 import 금지.
- 모달 z-index / overlay 는 기존 `connect-wallet-modal` 과 충돌 없도록.

# 설계 - v1.0.1

## 접근법
각 회귀를 원본(`src/`) 동작과 1:1로 맞추는 최소 변경.

핵심 결정:
1. **실패 audit log + 응답 shape 복원**: `PlanService.composeForRequest` 와
   `MarketplaceService.composeBasket` 의 try/finally 에 catch 블록 추가 →
   `logPlanRequest({rejectedRuleId:"agent.error"})` 호출 후 원본과 동일한
   `{ error: "..." }` 500 반환 (`ComposeResult` 의 raw payload 유지).
2. **retry-after 헤더 복원**: `PlanController.create` 가 rate limit 시
   `HttpException` 의 두 번째 인자 대신 `Res` 로 직접 status + header 설정.
3. **Intent abort 흐름 정합**: `IntentService.parse` 가 `signal` 을
   `llm.chat()` 에 전달 (AbortSignal 직접 wiring), abort 발생 시 휴리스틱
   fallback 대신 throw. `AcpxLLMAdapter.chat` 가 `signal` 인자를 받아
   subscriber 외부에서 child kill 가능하도록 확장.
4. **Marketplace plan catch 추가**: 1과 동일 패턴.
5. **Portfolio health 502 복원**: `InternalServerErrorException` 대신
   `HttpException(payload, 502)`.
6. **Rehydrate schema parse 복원**: `PlanService.rehydrate` 가 반환 직전
   `PipelinePlanSchema.parse(refreshed)` 호출.
7. **Validation envelope 원형 복원**: `ZodValidationPipe` 가 원본 route 와
   동일한 `{ error: "Invalid plan request", issues }` 등을 던지도록
   per-route 메시지를 옵션 인자로 받게 변경. 기본값은 v1.0.0 envelope 유지하되
   기존 6개 controller 는 명시적 메시지 전달.

## 버린 대안
- "envelope 통일 유지" — DoD 의 외부 계약 보존이 우선이라 기각.
- "supertest 6개 신규 작성" — 범위 폭증, 별도 phase 로 미룸.

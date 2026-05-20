# Step 03: Intent abort/timeout 정합

## 메타데이터
- **난이도**: 🟠
- **선행 조건**: 없음

## 구현 내용
- `AgentLLMPort.chat` signature 확장: `signal?: AbortSignal` 옵션 인자 추가.
- `AcpxLLMAdapter.chat`: signal 받으면 `signal.addEventListener("abort", () => child.kill("SIGTERM"))` 또는 spawn 후 즉시 종료.
- `IntentService.parse`:
  - `signal` 을 `llm.chat({ signal, ... })` 에 전달
  - abort 케이스 발견 시 `throw err`(휴리스틱 fallback 미적용) — error 원인이 abort 인지(`signal?.aborted`) 검사
  - 기타 오류는 기존처럼 휴리스틱 fallback
- `IntentService` 의 timeout(자체 15s) 추가 — 외부 signal 미설정 시도 안전 종료 보장.
- 신규 unit test: abort 시 throw 검증.

## 완료 조건
- [ ] AgentLLMPort 추상 메서드 시그니처에 `signal?: AbortSignal`
- [ ] AcpxLLMAdapter 가 signal abort 시 child.kill 호출
- [ ] IntentService.parse 가 signal aborted 면 throw (heuristic 호출 안 함)
- [ ] `apps/server/src/domains/agent/application/__tests__/intent.service.test.ts` 에 abort 시나리오 1개 추가

## Scope
### 수정 대상
- `apps/server/src/domains/agent/domain/agent-llm.port.ts`
- `apps/server/src/domains/agent/infrastructure/acpx-llm.adapter.ts`
- `apps/server/src/domains/agent/application/intent.service.ts`
- `apps/server/src/domains/agent/application/__tests__/intent.service.test.ts`

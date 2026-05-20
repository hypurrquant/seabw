# DoD - v1.0.1

## 완료 조건

| # | 조건 | 검증 방법 |
|---|------|----------|
| 1 | `PlanService.composeForRequest` 가 예외 시 `logPlanRequest({rejectedRuleId:"agent.error", ok:false})` 호출 후 `{ error: "We couldn't build a safe plan for that. <msg>" }` 500 반환 | `grep -n "agent.error" apps/server/src/domains/plan/plan.service.ts` 존재 + 본문에 catch 블록 |
| 2 | `PlanController.create` 가 429 응답에 `retry-after` 헤더 포함 | `grep -n "retry-after\|setHeader" apps/server/src/domains/plan/plan.controller.ts` |
| 3 | `IntentService.parse` 가 `signal` 을 `llm.chat()` 호출에 전달하고, abort 시 `throw` (fallback 미적용) | `grep -n "signal" apps/server/src/domains/agent/application/intent.service.ts` + unit test 추가 |
| 4 | `AgentLLMPort.chat` signature 에 optional `signal` 추가 + `AcpxLLMAdapter` 가 abort 신호에 child kill | `grep -n "signal" apps/server/src/domains/agent/domain/agent-llm.port.ts` 및 `acpx-llm.adapter.ts` |
| 5 | `MarketplaceService.composeBasket` 가 예외 시 `{ error: "Couldn't build basket plan: <msg>" }` 500 반환 | `grep -n "Couldn't build basket plan" apps/server/src/domains/marketplace/marketplace.service.ts` |
| 6 | `PortfolioController.health` 가 defi-cli 실패 시 502 반환 (500 아님) | `grep -n "502\|HttpException.*502" apps/server/src/domains/portfolio/portfolio.controller.ts` |
| 7 | `PlanService.rehydrate` 가 반환 직전 `PipelinePlanSchema.parse(refreshed)` 호출 | `grep -n "PipelinePlanSchema" apps/server/src/domains/plan/plan.service.ts` |
| 8 | `ZodValidationPipe` 가 옵션 메시지로 envelope 형식을 변경 가능, 6개 controller 는 원본 메시지를 명시 전달 (`Invalid plan request`, `Invalid precheck payload`, `Invalid rehydrate payload`, `Invalid basket request`, `Missing or invalid tier`, `Invalid address or chainId`) | `grep -rn "Invalid plan request\|Invalid precheck payload\|Invalid rehydrate payload\|Invalid basket request" apps/server/src` |

## 기본 검증
- [ ] `pnpm verify:dod` 통과 (v1.0.0 회귀 없음)
- [ ] `find src -type f \| wc -l` = 72 (baseline 유지)
- [ ] `grep -rn "@anthropic-ai/sdk\|ANTHROPIC_API_KEY" apps/` = 0

# Step 02: Plan 실패 audit log + 응답 shape 복원 + retry-after

## 메타데이터
- **난이도**: 🟠
- **선행 조건**: 없음

## 구현 내용
- `PlanService.composeForRequest` 의 try/finally 에 catch 추가:
  - `logPlanRequest({ ts, anonId, tier, intentLen, appliedRules: [], rejectedRuleId: "agent.error", durationMs, ok: false })`
  - return `{ kind: "rejected", status: 500, body: { error: \`We couldn't build a safe plan for that. \${msg}\` } }`
- `PlanController.create` 의 429 분기를 `Res` 직접 응답으로 변경 + `retry-after` 헤더 세팅
  (`res.setHeader("retry-after", Math.ceil(rate.retryAfterMs/1000)).status(429).json({error:"Too many plan requests. Please wait."})`).

## 완료 조건
- [ ] PlanService.composeForRequest 에 catch 블록 존재 + `agent.error` audit
- [ ] 응답 메시지가 `"We couldn't build a safe plan for that. "` 로 시작
- [ ] /api/plan 429 응답에 retry-after 헤더 포함

## Scope
### 수정 대상
- `apps/server/src/domains/plan/plan.service.ts`
- `apps/server/src/domains/plan/plan.controller.ts`

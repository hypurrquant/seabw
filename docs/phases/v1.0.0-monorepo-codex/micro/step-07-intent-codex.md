# Step 07: IntentService — Anthropic 제거 + Codex 경유

## 메타데이터
- **난이도**: 🟠 중간
- **롤백 가능**: ✅
- **선행 조건**: Step 05, Step 06

---

## 1. 구현 내용

`src/agent/intent.ts`의 Anthropic SDK 호출 로직을 server의 `IntentService`로 재작성. LLM 호출은 `AgentLLMPort.chat()` 경유 (codex/acpx).

### IntentService 위치/시그니처
- `apps/server/src/domains/agent/application/intent.service.ts`
- `@Injectable()`
- 생성자에 `AgentLLMPort` 주입
- 메서드: `parse(rawText: string, chainId?: number, signal?: AbortSignal): Promise<ParsedIntent>`

### 동작
1. systemPrompt: "You are an intent parser ... Output strictly a single JSON object with fields {symbol, amount, horizon, preferences}. No prose, no code fence."
2. `llm.chat({ systemPrompt, messages: [{ role: 'user', content: rawText }], context: { sessionKey: `intent-${nanoid()}` } })` 호출 → Observable<AgentSSEEvent>
3. stream delta 누적 → 종료 시 텍스트 buffer.
4. 첫 `{` ~ 마지막 `}` 추출 → `JSON.parse` 시도.
5. `ParsedIntentSchema.parse(...)` 검증 + chainId 주입.
6. **실패 케이스 모두 휴리스틱 fallback**:
   - acpx spawn 실패 (error event)
   - stream 중 error event
   - JSON 추출 실패
   - parse 실패
   - schema validation 실패
   - timeout (기본 15s)
7. 성공 시 ParsedIntent 반환.

### 휴리스틱 fallback
- 기존 `parseIntentHeuristic`을 그대로 `apps/server/src/domains/agent/application/intent.heuristic.ts` 로 복사 (Anthropic 의존 없음).
- IntentService.parse에서 모든 실패 경로에서 호출.

### PlanService에서 사용
- Step 05의 `PlanService`가 임시로 `parseIntentHeuristic`만 호출하던 부분을 IntentService.parse로 교체.
- Module 의존: PlanModule이 AgentModule을 imports 하고 IntentService를 inject.

### 정리
- `@anthropic-ai/sdk`, `@langchain/anthropic` 의존성 루트와 apps/server/package.json에서 **제거**.
- `ANTHROPIC_API_KEY` 참조 0 (apps/ 하위).
- src/agent/intent.ts는 보존(휴면).

## 2. 완료 조건
- [ ] `apps/server/src/domains/agent/application/intent.service.ts` 존재 + `@Injectable()`
- [ ] `IntentService.parse('3000 USDC for 6 months stable-only')`가 LLMPort mock 으로 정상 JSON 응답 시 ParsedIntent 반환 (unit test)
- [ ] LLMPort가 error event 송출 시 휴리스틱 fallback 결과 반환 (unit test)
- [ ] PlanService가 IntentService.parse 사용 (Step 05의 임시 휴리스틱 직접 호출 제거)
- [ ] `grep -rn "@anthropic-ai/sdk\|@langchain/anthropic\|ANTHROPIC_API_KEY" apps/` → 0
- [ ] `cat apps/server/package.json apps/web/package.json apps/core/package.json package.json | grep -c "anthropic"` → 0
- [ ] `pnpm --filter @seabw/server test` 통과

## 3. 롤백 방법
- `intent.service.ts`, `intent.heuristic.ts` 삭제
- PlanService 에서 IntentService inject 제거 + 휴리스틱 직접 호출로 복구
- (Anthropic 의존성 복구는 비권장 — 어차피 src/에 보존)

---

## Scope

### 신규 생성 파일
```
apps/server/src/domains/agent/application/intent.service.ts
apps/server/src/domains/agent/application/intent.heuristic.ts
apps/server/src/domains/agent/application/__tests__/intent.service.test.ts
```

### 수정 대상 파일
```
apps/server/src/domains/agent/agent.module.ts    # IntentService provider + export
apps/server/src/domains/plan/plan.module.ts      # AgentModule imports + IntentService 사용
apps/server/src/domains/plan/plan.service.ts     # parseIntent → this.intentService.parse
apps/server/package.json                          # @anthropic-ai/sdk, @langchain/anthropic 제거 (있었다면)
package.json                                      # 동일 (모노레포 루트에서 누락 제거)
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| AgentLLMPort | 사용 | IntentService 생성자 inject |
| @seabw/core schemas (ParsedIntentSchema) | import | 검증 |
| rxjs lastValueFrom / firstValueFrom | 신규 사용 | stream 종료 후 수집 |

### Side Effect 위험
- IntentService 호출이 acpx spawn → 응답 지연 (codex 응답 시간). 기존 Anthropic 호출 시간과 유사 또는 빠를 것.
- 휴리스틱 fallback 동작이 unit test로 보장 — 프로덕션에서 LLM 실패해도 plan 생성은 가능.

### 참고할 기존 패턴
- 기존 `src/agent/intent.ts:parseIntent` — 휴리스틱 fallback 패턴.
- 참조 `apps/server/src/domains/agent/application/agent-chat.service.ts` — Observable 수집 방법.

## FP/FN 검증

### FP
- IntentService를 별도 도메인으로 만들기 — 비대(scope 폭발). agent application 내에 두는 게 적정. ✅.

### FN
- timeout 15s 명시 ✅.
- chainId 인자 보존 (parseIntent 시그니처와 호환) ✅.
- PlanService 호출 지점 갱신 ✅.

### 검증 통과: ✅

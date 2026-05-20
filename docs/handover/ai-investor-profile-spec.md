# 작업위임서 — AI에게 유저 Tendency 전달

> 설문 결과(`Answers` + `TierResult`)를 통째로 LLM에 넘기되, **지갑 정보(PII)만 분리**한다. 과하게 정제하지 않는다.

---

## 6하원칙

### Who (누가)
- 다음 세션 누구든. 별도 권한 없음.

### What (무엇을)
- [ ] `AgentChatRequest` DTO에 `profile?: { answers: Answers; tier: TierResult }` 필드 추가 (`apps/core/http/dto.ts`)
- [ ] `AgentSession` 도메인 타입에 `profile` 필드 추가, 세션 생성 시 받아서 보관 (`apps/server/src/domains/agent/domain/agent.types.ts`, `infrastructure/in-memory-session.adapter.ts`)
- [ ] `AgentChatService.handle()`에서 세션 profile을 가져와 system 메시지로 한 번 주입 (`apps/server/src/domains/agent/application/agent-chat.service.ts:35`)
- [ ] `IntentService.parse()` 시그니처에 `profile?` 추가, 있으면 system prompt 앞에 JSON으로 박음 (`apps/server/src/domains/agent/application/intent.service.ts:31`)
- [ ] 웹 클라이언트가 세션 만들 때 `state.answers` + `state.tier`를 그대로 동봉 (`apps/web/src/state/app-state.tsx` 에서 꺼냄)
- [ ] **지갑 정보는 절대 profile에 넣지 않음** — 기존 PlanRequest의 wallet 경로만 사용

### When (언제)
- 선행 조건: 없음. 즉시 가능.
- 기한 없음.

### Where (어디서)
- `apps/core/http/dto.ts` — `AgentChatRequest`, `AgentSessionDTO`
- `apps/core/schemas/index.ts` — 필요 시 `AnswersSchema`, `TierResultSchema` 를 AgentChatRequest 검증에 재사용 (이미 export 되어 있음)
- `apps/server/src/domains/agent/domain/agent.types.ts` — Session 타입
- `apps/server/src/domains/agent/infrastructure/in-memory-session.adapter.ts` — 세션 저장 시 profile 같이
- `apps/server/src/domains/agent/application/agent-chat.service.ts` — system prompt 주입 지점
- `apps/server/src/domains/agent/application/intent.service.ts` — intent 파서에도 동일
- `apps/web/src/components/intent-input.tsx` — chat 시작 시 profile 동봉 (해당되면)

### Why (왜)
- 현재 LLM(`AgentChatService`, `IntentService`)은 유저 성향을 **하나도 안 받음**. 시스템 프롬프트에 "based on their tier" 라고 써있지만 실제 데이터는 안 들어감.
- 가드레일/컴포저(룰 엔진)만 `tier, rawScore, literacyScore, derivativeExpScore, vulnerableConsumer` 5개를 받고 있음.
- 결과: LLM은 "balanced 유저인지 degen인지" 모르고 답변함 → 비전("AI가 유저 정보로 의사결정")과 갭.
- "안 넣을지 말지"보다 **그냥 다 넣는 게 정답**. 토큰 부담 없음(필드 10여개), 결정점 줄임.

### How (어떻게)

**1) DTO 추가**
```ts
// apps/core/http/dto.ts
import type { Answers, TierResult } from "../types";

export interface InvestorProfile {
  answers: Answers;
  tier: TierResult;
}

export interface AgentChatRequest {
  sessionId: string;
  message: string;
}

// 세션 생성 요청 (신규 또는 기존 확장)
export interface AgentSessionCreateRequest {
  profile?: InvestorProfile;
}
```

**2) 세션에 profile bind (요청마다 동봉 X)**
```ts
interface AgentSession {
  sessionId: string;
  owner: string;
  profile?: InvestorProfile;     // 신규
  createdAt: string;
}
```
세션 생성 시 한 번 받아 보관 → chat 요청은 가벼움 유지 + Anthropic prompt cache(5분 TTL) 친화.

**3) System prompt 주입**
```ts
// agent-chat.service.ts
const profileBlock = session?.profile
  ? `User profile (raw survey + derived tier):\n${JSON.stringify(session.profile, null, 2)}\n\nUse this to tailor advice. Respect tier hard limits.`
  : "";

const messages: LLMMessage[] = [
  { role: "system", content: [profileBlock, DEFAULT_SYSTEM_PROMPT].filter(Boolean).join("\n\n") },
  ...history,
  { role: "user", content: input.message },
];
```

**4) Intent 파서도 동일** — `parse(rawText, chainId, profile?, signal?)` 로 시그니처 확장, 있으면 system prompt 앞에 같은 블록을 박음.

**5) 보내는 데이터 (그대로 통째)**
```jsonc
{
  "answers": {
    "horizon": 3, "allocation": 2, "experienceProducts": ["lp","swap"],
    "experienceYears": 3, "returnAttitude": 3, "lossTolerance": 3,
    "literacy": 3, "derivativeExp": 1,
    "ageBucket": "under65", "firstTimeDefiPilot": false
  },
  "tier": {
    "tier": "balanced", "rawScore": 18, "derivativeExpScore": 1,
    "downgradedFromDegen": false, "vulnerableDowngrade": false
  }
}
```
- ✅ 포함: `Answers` 전부 + `TierResult` 전부
- ❌ 제외: `wallet.address`, `wallet.holdings`, `wallet.gasBalanceWei` (PII — chat에 들어갈 이유 없음, 기존 PlanRequest 경로만 사용)

워크플로우 제안: `/quick-phase-workflow` (변경 범위 좁고 행동 변경 명확).

---

## 맥락

### 현재 상태
- 브랜치: `develop` (clean)
- 모노레포: `apps/{core,server,web}`
- 가드레일은 5신호 받음 (`GuardrailContext` in `guardrails.ts:15`), LLM은 0신호.
- AgentChatService 시스템 프롬프트(`agent-chat.service.ts:8`)에 "based on their tier" 만 텍스트로 있고 실제 주입 없음.

### 사용자 확정 결정사항
- **그냥 다 보낸다** — 도출 신호만 골라 보내거나 자연어로 재구성하는 짓 하지 말 것.
- **지갑 정보만 분리** — Answers/TierResult는 chat에, wallet은 plan에. 섞지 않음.
- **세션 bind 권장** — 요청마다 매번 동봉하지 말고 세션 생성 시 한 번.

### 미결정 (구현자가 사용자와 합의)
- 세션 생성 API 시그니처 (현재 `getMessages` 자동 생성 식이라 명시적 create 엔드포인트가 있는지 확인 필요 — `agent.controller.ts`)
- profile 갱신 정책: 재설문 시 세션 새로 만들지, 기존 세션을 업데이트할지

### 참조
| 항목 | 경로 |
|---|---|
| 타입 정의 | `apps/core/types/index.ts` (Answers, TierResult) |
| Zod 스키마 | `apps/core/schemas/index.ts` (AnswersSchema, TierResultSchema 재사용 가능) |
| 가드레일 (5신호 이미 받음) | `apps/server/src/domains/plan/internal/guardrails.ts:15` |
| LLM 챗 (미접속점) | `apps/server/src/domains/agent/application/agent-chat.service.ts` |
| LLM Intent (미접속점) | `apps/server/src/domains/agent/application/intent.service.ts` |
| 세션 어댑터 | `apps/server/src/domains/agent/infrastructure/in-memory-session.adapter.ts` |
| DTO | `apps/core/http/dto.ts` |

---

## 주의사항
- **지갑 정보 분리 원칙**: profile은 행동 신호만. wallet은 PlanRequest 경로 그대로. 둘이 같은 객체에 들어가지 않게.
- 세션 메모리 어댑터(`in-memory-session.adapter.ts`)가 in-memory라 서버 재시작 시 profile 날아감 — 데모 단계에선 OK, 운영 시점에 persistence 결정 필요.
- prompt cache: profile 블록을 항상 같은 위치(맨 앞)에 두어야 cache hit. 위치 흔들지 말 것.

## 시작 방법
1. `apps/core/http/dto.ts`에 `InvestorProfile` + `AgentSessionCreateRequest` 추가
2. `apps/server/src/domains/agent/domain/agent.types.ts`의 Session 타입에 `profile?` 추가
3. `in-memory-session.adapter.ts` 의 create/get 경로에 profile pass-through
4. `agent-chat.service.ts:handle()` 에서 system 메시지 주입
5. `intent.service.ts:parse()` 시그니처 확장 + 동일 주입
6. `apps/web` 에서 세션 생성 시 `state.answers` + `state.tier` 동봉
7. 직접 챗 보내서 LLM이 tier 라벨/literacy를 답변에 반영하는지 확인

# Step 05: chat.tsx 연계 — clear + selection sendMessage

## 메타데이터
- **난이도**: 🟡 보통
- **롤백 가능**: ✅ (chat.tsx git revert)
- **선행 조건**: Step 02 (store) + Step 04 (modal — onSelect prop 정의)

---

## 1. 구현 내용 (design.md 기반)

- `apps/web/src/domains/chat/chat.tsx` 수정
  - **(A) onSend 직전 clearProposal**: 사용자가 새 메시지 보낼 때 카드 모달 즉시 제거
    ```ts
    async function onSend() {
      const text = input.trim();
      if (!text || !sessionId || busy) return;
      useLpProposalStore.getState().clearProposal(sessionId);   // 추가
      setInput("");
      await runChat(sessionId, text);
    }
    ```
  - **(B) Modal 의 onSelect → sendMessage 자동 발행**:
    - `<LpProposalModalHost/>` 가 chat.tsx 안에서 마운트되지 않고 providers 트리에 있어서 sessionId 와 sendMessage 를 알아야 함.
    - 옵션: providers 의 host 가 `useAgentChat()` 을 직접 호출 → onSelect 핸들러 내부에서 `sendMessage('[Selection] I choose option ' + rank + '.', sessionId)` + `clearProposal(sessionId)`.
    - chat.tsx 변경은 (A) 의 1줄. selection wiring 은 lp-proposal-modal.tsx 내부에서.
  - 즉, **Step 05 는 (A) chat.tsx 1줄 + (B) lp-proposal-modal.tsx 의 onSelect 구현 (Step 04 에서 prop 만 정의됐던 것을 host 내부에서 채움)**.

## 2. 완료 조건 ⚠️

- [ ] `chat.tsx` 의 `onSend()` 가 `clearProposal(sessionId)` 호출 (`grep "clearProposal" chat.tsx` 1 hit)
- [ ] 새 메시지 입력 시 카드 모달 즉시 사라짐 (수동 S2)
- [ ] `lp-proposal-modal.tsx` 의 host 가 카드 클릭 시 `useAgentChat().sendMessage('[Selection] I choose option <rank>.', sessionId)` 호출 (`grep "I choose option" lp-proposal-modal.tsx` 1 hit)
- [ ] 카드 클릭 직후 `clearProposal(sessionId)` 호출 (lp-proposal-modal.tsx 내부)
- [ ] 카드 클릭 → 모달 닫힘 → 자동 메시지가 chat 메시지 영역에 표시 (수동 S1)
- [ ] sendMessage 실패 시 토스트 + clearProposal 롤백 (모달 재오픈) — E5 검증 (수동, devtools 로 fetch block)
- [ ] `pnpm typecheck` + `pnpm build` 통과

## 3. 롤백 방법

- `chat.tsx` git revert (1줄 변경)
- `lp-proposal-modal.tsx` 의 onSelect 구현 부분 revert (모달은 보존, 클릭 동작만 무력화)
- 영향 범위: 카드 클릭이 동작 안 함 — 사용자가 카드 보고 별도 행동 못 함. 새 메시지 시에도 모달 안 사라짐.

---

## Scope

### 수정 대상 파일
```
apps/web/src/domains/chat/
├── chat.tsx                # 수정 - onSend 직전 clearProposal 1줄
└── lp-proposal-modal.tsx   # 수정 - host 내부 onSelect 핸들러 채움 (Step 04 에서 prop 정의만)
```

### 신규 생성 파일
없음.

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| Step 02 `useLpProposalStore` | import | clearProposal, selectProposal |
| HQ `useAgentChat` | import | sendMessage(text, sessionId) — Explore 6번 확인 |

### Side Effect 위험
- **risk 1**: `useAgentChat` 의 `sendMessage` 가 providers 트리의 host 에서 호출되려면 host 가 `useAgentChat()` hook 을 콜할 수 있어야 함. 만약 hook 이 `<AgentChatProvider/>` 안에서만 동작한다면 host mount 위치를 그 안쪽으로 옮겨야 함 (Step 04 와 함께 점검).
- **risk 2**: 카드 클릭 후 sendMessage 가 실패할 경우 — 모달은 이미 닫힌 상태. 토스트 + clearProposal 롤백 처리 필요.
- **risk 3**: 사용자가 chat 메시지 자동 발행 직후 다른 메시지를 빠르게 보낼 경우 — store clear 가 두 번 호출돼도 idempotent 라 OK.

### 참고할 기존 패턴
- 현재 `chat.tsx:101-106` 의 `onSend` 구현.
- HQ `useAgentChat().sendMessage(text, sessionId)` API (Explore 6).

---

## FP/FN 검증

### False Positive (과잉)
| Scope 항목 | 구현 내용 근거 | 판정 |
|-----------|---------------|------|
| `chat.tsx` 수정 | onSend 직전 clearProposal | ✅ OK |
| `lp-proposal-modal.tsx` 수정 | onSelect 핸들러 — sendMessage + clearProposal | ✅ OK |

### False Negative (누락)
| 구현 내용 | Scope 포함 | 판정 |
|----------|-----------|------|
| 카드 클릭 → sendMessage | ✅ lp-proposal-modal.tsx | OK |
| 새 메시지 → clear | ✅ chat.tsx | OK |
| sendMessage 실패 시 롤백 | ✅ lp-proposal-modal.tsx 내부 핸들러 | OK |

### 검증 통과: ✅

---

→ 다음: [Step 06: HQ MCP + system prompt + smoke](step-06-hq-and-smoke.md)

# 작업 티켓 - v1.2.0

| # | Step | 난이도 | 개발 |
|---|------|--------|------|
| 01 | HQ worktree 패치 — system prompt env + sessions profile + chat profile inject + auth dev bypass | 🟠 | ⏳ |
| 02 | docs/seabw-system-prompt.md 작성 (DefiPilot 페르소나) | 🟢 | ⏳ |
| 03 | seabw web: lib/hq-api.ts + lib/tendency-prompt.ts | 🟡 | ⏳ |
| 04 | seabw web: domains/chat/chat.tsx 실제 구현 (HQ SSE 연동) | 🟠 | ⏳ |
| 05 | seabw web: app/page.tsx chat stage split-screen 레이아웃 + tier-result readOnly prop | 🟡 | ⏳ |
| 06 | env 갱신 + 문서 (CLAUDE.md/PROGRESS) + smoke | 🟡 | ⏳ |

## 의존성
```
01 ──→ 04
02 ──→ (06)
03 ──→ 04
04 ──→ 05 ──→ 06
```

## Step 상세
- [Step 01: HQ worktree 패치](step-01-hq-patch.md)
- [Step 02: System prompt 작성](step-02-system-prompt.md)
- [Step 03: seabw web lib](step-03-web-lib.md)
- [Step 04: chat 컴포넌트](step-04-chat-component.md)
- [Step 05: split-screen 레이아웃](step-05-split-layout.md)
- [Step 06: env + 문서 + smoke](step-06-env-docs-smoke.md)

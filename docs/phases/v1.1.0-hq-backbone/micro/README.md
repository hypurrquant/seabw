# 작업 티켓 - v1.1.0

## 전체 현황

| # | Step | 난이도 | 개발 |
|---|------|--------|------|
| 01 | 옛 도메인·컴포넌트 일괄 삭제 (apps/server, apps/core, 옛 components/pages) + survey/chains/tiers를 apps/web/src/lib 으로 흡수 + 루트 workspace/scripts 정리 | 🟠 | ✅ |
| 02 | apps/web 새 흐름 — chat placeholder + tendency prompt 변환 + state 슬림화 (UI 재디자인은 X) | 🟡 | ✅ |
| 03 | HQ /agent/chat SSE wiring + wagmi sign loop (build-step ↔ step-complete) | 🟠 | ⏳ |
| 04 | docs/seabw-system-prompt.md 작성 + HQ worktree에 `AGENT_SYSTEM_PROMPT_FILE` env hook 패치 | 🟡 | ⏳ |
| 05 | 통합 smoke (HQ 부팅 → seabw web 부팅 → 설문 → chat → 서명 1회) + 문서 갱신 | 🟡 | ⏳ |

## 의존성

```
01 ──→ 02 ──→ 03 ──→ 05
                ↑
04 ─────────────┘
```

## Step 상세
- [Step 01: 옛 코드 일괄 삭제](step-01-purge-old-code.md)
- [Step 03: web HQ wiring](step-03-web-hq-wiring.md)
- [Step 04: System prompt + HQ env hook 패치](step-04-system-prompt-and-hq-patch.md)
- [Step 05: Smoke + 문서 갱신](step-05-smoke-and-docs.md)

(이전 v1.1.0 plan의 step-02-server-placeholder는 폐기 — apps/server 통째 삭제로 대체됨.)

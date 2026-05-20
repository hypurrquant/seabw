# 작업 티켓 - v1.0.0

## 전체 현황

| # | Step | 난이도 | 롤백 | Scope | FP/FN | 개발 | 완료일 |
|---|------|--------|------|-------|-------|------|--------|
| 01 | 모노레포 스켈레톤 | 🟡 | ✅ | ✅ | ✅ | ⏳ | - |
| 02 | apps/core 패키지 | 🟢 | ✅ | ✅ | ✅ | ⏳ | - |
| 03 | NestJS 서버 부트스트랩 | 🟡 | ✅ | ✅ | ✅ | ⏳ | - |
| 04 | 서버 내부 로직 이전 | 🟠 | ✅ | ✅ | ✅ | ⏳ | - |
| 05 | 4개 도메인 모듈 + 6개 API | 🟠 | ✅ | ✅ | ✅ | ⏳ | - |
| 06 | Agent 도메인 이식 | 🔴 | ✅ | ✅ | ✅ | ⏳ | - |
| 07 | IntentService (codex) | 🟠 | ✅ | ✅ | ✅ | ⏳ | - |
| 08 | apps/web 이전 + http wrapper | 🟠 | ✅ | ✅ | ✅ | ⏳ | - |
| 09 | 테스트 이전 + verify:dod | 🟠 | ✅ | ✅ | ✅ | ⏳ | - |
| 10 | 루트 정리 + 문서 + 최종 검증 | 🟡 | ✅ | ✅ | ✅ | ⏳ | - |

## 의존성

```
01 ──► 02 ──► 03 ──► 04 ──► 05 ──► 07 ──► 09 ──► 10
          │                  │
          │                  └─► 06 ──┘
          │                                ▲
          └──────────► 08 ─────────────────┘
                       ▲
                       └─ 05 (server endpoints 존재 시 의미 있음)
```

- Step 06 (agent)은 Step 03 이후 언제든 가능 (Step 04와 병렬 가능). Step 07은 06+05 모두 필요.
- Step 08 (web)은 02 + 05 필요.

## 커버리지 매트릭스

### PRD 목표 → 티켓

| PRD 목표 | 관련 티켓 | 커버 |
|----------|----------|------|
| (1) 모노레포 전환 (apps/{server,web,core}) | 01, 02, 03, 08 | ✅ |
| (2) Codex agent 이식 (chat-only) | 06, 07 | ✅ |
| (3) Anthropic SDK 제거 | 07, 10 | ✅ |
| (4) API 경계 타입 SSOT | 02, 05, 08 | ✅ |
| src/ 보존 | 01, 09, 10 (검증) | ✅ |

### DoD → 티켓

| DoD | 관련 티켓 | 커버 |
|-----|----------|------|
| F1 pnpm-workspace.yaml | 01 | ✅ |
| F2 3개 워크스페이스 | 01 | ✅ |
| F3 루트 scripts 8개 | 01 | ✅ |
| F4 src/ 보존 | 01 (작성), 10 (검증) | ✅ |
| F5 @seabw/core 이름 | 02 | ✅ |
| F6 index.ts re-export | 02 | ✅ |
| F7 ApiResponse 정의 | 02 | ✅ |
| F8 6개 API DTO + agent | 02, 06 | ✅ |
| F9 core 의존성 최소 | 02 | ✅ |
| F10 nest build | 03 | ✅ |
| F11 4000 listen + health 응답 | 03, 05 | ✅ |
| F12 6개 controller endpoint | 05 | ✅ |
| F13 SSE /agent/chat | 06 | ✅ |
| F14 controller 타입 annotation | 05, 06 | ✅ |
| F15 internal 모듈 이전 | 04 | ✅ |
| F16 Anthropic import 0 | 07 | ✅ |
| F17 agent 4-layer 디렉토리 | 06 | ✅ |
| F18 3 Port 추상 클래스 | 06 | ✅ |
| F19 AcpxLLMAdapter | 06 | ✅ |
| F20 InMemorySessionAdapter | 06 | ✅ |
| F21 DevStubAuthAdapter | 06 | ✅ |
| F22 chat.service Observable | 06, 09 | ✅ |
| F23 MCP 파일/엔드포인트 부재 | 06, 09 | ✅ |
| F24 IntentService via LLMPort | 07 | ✅ |
| F25 acpx 실패 → 휴리스틱 fallback | 07, 09 | ✅ |
| F26 anthropic 의존 0 | 07, 10 | ✅ |
| F27 ANTHROPIC_API_KEY 참조 0 | 07, 09 | ✅ |
| F28 apps/web/src/app/api 부재 | 08 | ✅ |
| F29 next build | 08 | ✅ |
| F30 3000 listen | 08 | ✅ |
| F31 모든 fetch http.ts wrapper | 08 | ✅ |
| F32 http<T> loose 금지 | 08 | ✅ |
| F33 골든 패스 동작 | 08, 10 | ✅ |
| N1 strict tsc | 09, 10 | ✅ |
| N2 server test pass | 09 | ✅ |
| N3 core test pass | 09 | ✅ |
| N4 server build | 03, 10 | ✅ |
| N5 web build | 08, 10 | ✅ |
| N6 pnpm install one-shot | 01, 10 | ✅ |
| N7 core workspace:* | 02, 03, 08 | ✅ |
| N8 web→server import 0 | 08, 09 (검증) | ✅ |
| N9 server→web import 0 | 06, 09 (검증) | ✅ |
| N10 src/ 보존 | 01, 10 | ✅ |
| N11 phase 문서 | 01-04, 10 | ✅ |
| E1 acpx 부재 | 06, 07 | ✅ |
| E2 비-JSON | 07, 09 | ✅ |
| E3 unknown sessionId | 06 | ✅ |
| E4 zod 위반 → 400 | 03, 05 | ✅ |
| E5 화이트리스트 0 | 04, 05 | ✅ |
| E6 src/ test 무영향 | 09 | ✅ |
| E7 동일 sessionId 동시 | 06 | ✅ |
| E8 chat abort | 06 | ✅ |
| E9 sanctioned | 04, 05 | ✅ |
| E10 defi-cli prod 모드 | 04 | ✅ |

### 설계 결정 → 티켓

| 설계 결정 | 관련 티켓 | 커버 |
|----------|----------|------|
| pnpm workspace | 01 | ✅ |
| NestJS 11 + SWC | 03 | ✅ |
| apps/core SSOT | 02 | ✅ |
| 4 도메인 + 6 controller | 05 | ✅ |
| Agent 4-layer DDD | 06 | ✅ |
| AcpxLLMAdapter | 06 | ✅ |
| InMemorySessionAdapter | 06 | ✅ |
| DevStubAuthAdapter | 06 | ✅ |
| MCP 제외 | 06 (명시 제거) | ✅ |
| IntentService via LLMPort | 07 | ✅ |
| Anthropic 제거 | 07, 10 | ✅ |
| web fetch wrapper + base URL env | 08 | ✅ |
| src/ 보존 | 01, 10 | ✅ |
| 외부 path/shape 호환 | 05 | ✅ |
| CORS WEB_ORIGIN | 03 | ✅ |
| ZodValidationPipe | 03 | ✅ |
| ExceptionFilter envelope | 03 | ✅ |
| ApiResponse 타입 | 02 | ✅ |
| Playwright webServer 두 개 | 10 | ✅ |

## Definition of Ready

- [x] 모든 티켓 정의 + 완료 조건 엄격 작성
- [x] 모든 티켓 Scope 명시
- [x] 모든 티켓 FP/FN 통과
- [x] 의존성 순서 확정
- [x] 커버리지 매트릭스 100% (PRD/DoD/설계 누락 없음)

## Step 상세
- [Step 01: 모노레포 스켈레톤](step-01-monorepo-skeleton.md)
- [Step 02: apps/core 패키지](step-02-core-package.md)
- [Step 03: NestJS 서버 부트스트랩](step-03-server-bootstrap.md)
- [Step 04: 서버 내부 로직 이전](step-04-server-internals.md)
- [Step 05: 4개 도메인 + 6개 API](step-05-server-domains.md)
- [Step 06: Agent 도메인 이식](step-06-agent-domain.md)
- [Step 07: IntentService (codex)](step-07-intent-codex.md)
- [Step 08: apps/web 이전 + http wrapper](step-08-web-migration.md)
- [Step 09: 테스트 이전 + verify:dod](step-09-tests-and-verify.md)
- [Step 10: 루트 정리 + 문서 + 최종 검증](step-10-cleanup-docs.md)

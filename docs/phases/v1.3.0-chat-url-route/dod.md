# DoD - v1.3.0

## 완료 조건

| # | 조건 | 검증 방법 |
|---|------|----------|
| 1 | 설문 완료 + tier-result CTA → URL 이 `/chat?a=<base64>` 로 바뀜 | 브라우저 수동 |
| 2 | /chat 새로고침 → answers 디코딩 + tier 재계산 + split 화면 유지 | 브라우저 수동 |
| 3 | `?a=` 없이 /chat 진입 → `/` 로 redirect | 브라우저: `/chat` 직접 입력 |
| 4 | `?a=invalid` 로 /chat 진입 → `/` 로 redirect | 브라우저: `/chat?a=xxx` 입력 |
| 5 | auth 미인증 상태로 /chat 진입 → `/` 로 redirect | 브라우저: 새 시크릿창 `/chat?a=...` |
| 6 | encode/decode round-trip 보존 | 단위 테스트 |
| 7 | Stage 타입에서 `"chat"` 제거, page.tsx 의 chat case 제거 | grep 검증 |

## 기본 검증
- [ ] 타입 체크 통과 (`pnpm typecheck`)
- [ ] 린트 통과 (`pnpm --filter @seabw/web lint`)
- [ ] 빌드 성공 (`pnpm build`)
- [ ] 단위 테스트 통과 (`pnpm test`)

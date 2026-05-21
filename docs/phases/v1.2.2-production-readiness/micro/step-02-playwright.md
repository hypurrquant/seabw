# Step 02: playwright config 정리 + e2e script 분리

## 메타데이터
- **난이도**: 🟢 / **롤백**: ✅

## 구현 내용
- `playwright.config.ts` 의 `webServer` 배열에서 `@seabw/server` line 제거 (또는 주석).
- 루트 `package.json` 의 `test:e2e` script 를 `test:e2e:manual` 로 rename (또는 default 에서 분리).
- e2e 자체 통과는 본 phase scope 외 — config load 만 정상.

## 완료 조건
- [ ] `grep "@seabw/server" playwright.config.ts` → 0 (F5)
- [ ] 루트 package.json default scripts 에서 e2e 호출 없음 (F6)
- [ ] `npx playwright test --list` 가 config load 단계는 통과 (suite 실패는 무관)

## Scope
- 수정: `playwright.config.ts`, 루트 `package.json`
- Side effect: e2e 명령 호출 시 호출자가 새 script 이름 인지 — README 또는 commit msg 안내

## FP/FN 검증
- FP: 없음
- FN: e2e suite 자체 실패는 본 phase 외 — 사용자에게 명시
- 검증 통과: ✅

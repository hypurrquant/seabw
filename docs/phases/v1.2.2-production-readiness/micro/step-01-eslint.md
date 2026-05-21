# Step 01: ESLint flat config + lint script

## 메타데이터
- **난이도**: 🟠 / **롤백**: ✅

## 구현 내용
- `apps/web/eslint.config.mjs` 신규 — flat config, `eslint-config-next` 의 `core-web-vitals` ruleset.
- `apps/web/package.json` scripts 의 `lint` 를 `eslint . --max-warnings=0 --ext .ts,.tsx` 로 변경 (또는 flat config 기준 `eslint .`).
- 기존 `next lint` 의존 제거.
- 코드 lint 오류가 있으면 분석 후 fix 또는 inline disable 정당화.

## 완료 조건
- [ ] `eslint.config.mjs` 존재 (F1)
- [ ] `package.json` lint script 에 `next lint` 없음 (F2)
- [ ] `pnpm --filter @seabw/web lint` 비대화형 exit code 명확 (F3)
- [ ] `--max-warnings=0` 적용 (F4)

## Scope
- 수정: `apps/web/package.json`
- 신규: `apps/web/eslint.config.mjs`
- 의존성: `eslint-config-next` (next 15 와 함께 설치됨), `eslint` (devDep 확인)
- Side effect: 기존 lint 미적용 코드에서 violation 발견 시 패치 필요

## FP/FN 검증
- FP: 없음 (모든 scope 가 lint 완료 조건과 직결)
- FN: 가능한 lint 위반 패치 — 발견 시 수정 (`/* eslint-disable */` 남용 금지)
- 검증 통과: ✅

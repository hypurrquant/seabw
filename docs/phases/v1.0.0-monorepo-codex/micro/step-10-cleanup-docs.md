# Step 10: 루트 정리 + 문서 + 최종 검증

## 메타데이터
- **난이도**: 🟡 보통
- **롤백 가능**: ✅
- **선행 조건**: Step 01-09 전부

---

## 1. 구현 내용

### 루트 정리 (src/ 보존)
- 루트 `package.json`에서 Next/React/wagmi 등 client 의존성, Anthropic SDK, LangChain 의존성 제거 → workspace로 모두 이동 완료된 상태 확인.
- 루트의 Next 설정 파일들(`next.config.ts`, `postcss.config.mjs`, `next-env.d.ts`) 삭제.
- 루트의 `vitest.config.ts`, `vitest.mainnet.config.ts`, `vitest.setup.ts`, `vitest.mainnet.setup.ts` 삭제 (각자 apps/* 로 이동).
- 루트의 `tsconfig.json`은 monorepo references 형태로 유지 (Step 01에서 작성).
- 루트의 `playwright.config.ts`, `playwright.prod.config.ts`는 webServer 두 개로 변경 (web=3000, server=4000).
- 루트 `public/` 삭제 (apps/web으로 이동 완료).
- `src/` **삭제 금지** — 보존 확인.
- `.gitignore`에 `apps/*/node_modules`, `apps/*/dist`, `apps/*/.next` 포함 확인.
- `node_modules` 재설치: `pnpm install` 으로 깔끔한 트리.

### 문서 갱신
- 루트 `CLAUDE.md` 갱신: 현재 페이즈 상태 "Step 5 - 완료", 구조 확정.
- 루트 `README.md` 갱신 (있다면): 모노레포 부팅 절차 (acpx 설치 안내, .env.local 설정, `pnpm dev:server` + `pnpm dev:web`).
- `docs/phases/v1.0.0-monorepo-codex/PROGRESS.md` 최종 상태.

### 최종 검증
- `pnpm verify:dod` 실행 → 모두 통과.
- `pnpm -r exec tsc --noEmit` exit 0.
- `pnpm -r build` exit 0.
- `pnpm -r test` exit 0.
- 수동: 두 서버 부팅 후 골든 패스 동작.

## 2. 완료 조건
- [ ] 루트 `next.config.ts`, `postcss.config.mjs`, `next-env.d.ts` 부재
- [ ] 루트 `vitest.*.ts` 부재
- [ ] 루트 `public/` 부재
- [ ] 루트 `package.json`의 dependencies에 `next`, `react`, `react-dom`, `wagmi`, `viem`, `@anthropic-ai/sdk`, `@langchain/*` 없음 (devDep는 turbo/lint 등 도구만)
- [ ] `find src -type f | wc -l` 결과가 phase 시작 시점과 동일 (baseline 보존)
- [ ] CLAUDE.md 의 "현재 페이즈" 가 "완료" 또는 v1.0.0 종료 상태로 갱신
- [ ] `pnpm verify:dod` exit 0
- [ ] `pnpm -r exec tsc --noEmit` exit 0
- [ ] `pnpm -r build` exit 0
- [ ] `pnpm -r test` exit 0

## 3. 롤백 방법
- 루트 파일 git checkout
- `apps/` 디렉토리 삭제 시 src/로 완전 복귀

---

## Scope

### 삭제 대상 파일
```
next.config.ts                # 루트
postcss.config.mjs            # 루트
next-env.d.ts                 # 루트
vitest.config.ts              # 루트
vitest.mainnet.config.ts      # 루트
vitest.setup.ts               # 루트
vitest.mainnet.setup.ts       # 루트
public/                       # 루트
```

### 수정 대상 파일
```
package.json                  # 의존성 정리
playwright.config.ts          # webServer 두 개
playwright.prod.config.ts     # 동일
CLAUDE.md                     # 페이즈 종료 상태
.gitignore                    # apps/* 항목 확인
README.md                     # 부팅 안내 (있을 경우)
docs/phases/v1.0.0-monorepo-codex/PROGRESS.md   # Step 5 완료
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| pnpm lockfile | 재생성 | 의존성 분배로 잎이 변함 |
| playwright | webServer 설정 | 두 서버 부팅으로 e2e 시나리오 보존 |

### Side Effect 위험
- 루트 vitest 삭제 → 루트에서 `vitest`가 동작 안 함. `pnpm test`는 워크스페이스 위임으로 대체.
- src/는 휴면이므로 import 끊김 영향 없음. 단, src/ 내부에서 자체 vitest 돌리려는 미래 시도가 있다면 별도 설정 필요 (현재 비범위).

### 참고할 기존 패턴
- 참조 `playwright.config.ts`의 webServer 두 개 패턴.

## FP/FN 검증

### FP
- src/ 삭제 — 비범위. ✅ 제외 명시.

### FN
- README/CLAUDE.md 갱신 ✅.
- verify:dod 실행 ✅.
- src/ baseline 검증 ✅.

### 검증 통과: ✅

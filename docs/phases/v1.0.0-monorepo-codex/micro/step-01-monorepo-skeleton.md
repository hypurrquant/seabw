# Step 01: pnpm 모노레포 스켈레톤 + 워크스페이스 생성

## 메타데이터
- **난이도**: 🟡 보통
- **롤백 가능**: ✅ (root files만 추가/수정, git revert로 복원)
- **선행 조건**: 없음

---

## 1. 구현 내용

- 루트 `pnpm-workspace.yaml` 생성: `apps/*` 패턴.
- 루트 `package.json`을 모노레포 루트로 전환:
  - `private: true`, `packageManager: pnpm@10`
  - 기존 Next.js 의존성/스크립트 제거, 워크스페이스 위임 스크립트 추가: `dev`, `dev:server`, `dev:web`, `build`, `build:server`, `build:web`, `test`, `lint`.
  - 기존 `dependencies`는 워크스페이스로 이동 (Step 02/04/08에서 분배).
- 루트 `tsconfig.base.json` 신설: strict, ES2022, moduleResolution=Bundler, paths 빈 객체.
- 루트 `tsconfig.json`은 `references` 만 두고 `noEmit: true`.
- `apps/core`, `apps/server`, `apps/web` 디렉토리 + 각자의 빈 `package.json` (이름 `@seabw/core` / `@seabw/server` / `@seabw/web`, version `1.0.0`, private)와 placeholder `tsconfig.json` (extends base).
- 기존 루트 next 설정(`next.config.ts`, `postcss.config.mjs`, `vitest.config.ts` 등)은 일단 그대로 두고, Step 08에서 apps/web으로 이전.
- `.npmrc` 없으면 `shamefully-hoist=false` 명시는 생략. pnpm 기본값 사용.

## 2. 완료 조건
- [ ] `pnpm-workspace.yaml` 존재, `apps/*` 포함
- [ ] 루트 `package.json`에 `dev`, `dev:server`, `dev:web`, `build`, `build:server`, `build:web`, `test`, `lint` 8개 스크립트 정의
- [ ] `apps/{core,server,web}/package.json` 3개 존재 (각각 `@seabw/core`, `@seabw/server`, `@seabw/web`)
- [ ] `apps/{core,server,web}/tsconfig.json` 존재
- [ ] `tsconfig.base.json` 존재
- [ ] `pnpm install` 성공 (workspace 인식)
- [ ] `pnpm -r ls --depth -1`이 3개 워크스페이스 표시
- [ ] 기존 src/는 수정 0건 (`git status src/` clean)

## 3. 롤백 방법
- 추가된 파일 삭제: `apps/`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- `package.json` git checkout

---

## Scope

### 수정 대상 파일
```
package.json                # 모노레포 루트로 전환 (의존성은 일단 그대로 두고 후속 step에서 분배)
```

### 신규 생성 파일
```
pnpm-workspace.yaml
tsconfig.base.json
tsconfig.json               # references only
apps/core/package.json
apps/core/tsconfig.json
apps/server/package.json
apps/server/tsconfig.json
apps/web/package.json
apps/web/tsconfig.json
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| 루트 lockfile (pnpm-lock.yaml) | 재생성 | npm/pnpm 전환 시 lock 갱신 (기존 pnpm-lock.yaml 있음) |
| next.config.ts 등 | 보존 | Step 08까지는 그대로 두어 일단 root에서 next dev 가능 |

### Side Effect 위험
- 루트에 NEXT_BUILD 캐시(.next/)가 있으면 모노레포 부팅 시 영향 → `.next/`는 그대로 두고 무시.
- pnpm-lock.yaml의 hoist 변화 → CI 영향 없음 (현재 CI 미정).

### 참고할 기존 패턴
- `/Users/mousebook/Documents/side-project/HypurrQuant_FE/pnpm-workspace.yaml`
- `/Users/mousebook/Documents/side-project/HypurrQuant_FE/tsconfig.base.json`
- 루트 `package.json` scripts 패턴

## FP/FN 검증

### FP
- 없음 (모든 신규 파일이 구현 내용의 직접 산출물)

### FN
- `tsconfig.json` (루트 references) — Phase 1에서 누락 가능 → 명시 포함됨 ✅
- `.gitignore` 업데이트 (apps/*/dist, apps/*/node_modules) — 필요. 추가.

### 검증 통과: ✅

### 추가 산출물
- `.gitignore` 갱신 (apps/*/dist, apps/*/node_modules, apps/*/.next 추가)

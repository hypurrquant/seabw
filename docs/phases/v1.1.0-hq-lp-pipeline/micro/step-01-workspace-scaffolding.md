# Step 01: 워크스페이스 스캐폴딩

## 메타데이터
- **난이도**: 🟡 보통
- **롤백 가능**: ✅ (전체 디렉토리 + workspace 항목 삭제)
- **선행 조건**: 없음

---

## 1. 구현 내용 (design.md 기반)

- `packages/` 루트 디렉토리 생성 (현재 `apps/`만 존재)
- 4개 신규 워크스페이스 디렉토리 생성:
  - `packages/defi` (`@seabw/defi`)
  - `packages/defi-react` (`@seabw/defi-react`)
  - `packages/defi-http` (`@seabw/defi-http`)
  - `packages/wasm-crypto` (`@seabw/wasm-crypto`)
- 각 워크스페이스에 `package.json` + `tsconfig.json` 최소 골격
  - `package.json`: name/version/main/types/exports/peerDependencies(react/zustand/viem 등) + scripts(`build`, `test`, `typecheck`)
  - `tsconfig.json`: `extends: "../../tsconfig.base.json"` + composite/declaration 활성화
- 루트 `pnpm-workspace.yaml`에 `packages/*` 패턴 추가
- 루트 `tsconfig.base.json`의 `paths`에 `@seabw/defi`, `@seabw/defi-react`, `@seabw/defi-http`, `@seabw/wasm-crypto` 매핑 추가 (또는 workspace symbolic resolution 활용)
- `pnpm install` 실행해 lockfile에 신규 워크스페이스 등록

## 2. 완료 조건
- [ ] `packages/{defi,defi-react,defi-http,wasm-crypto}/package.json` 4개 존재
- [ ] `pnpm-workspace.yaml`에 `packages/*` 포함
- [ ] `pnpm install` 성공 (lockfile diff에 4개 신규 패키지 등록)
- [ ] `pnpm -r exec tsc --noEmit --emitDeclarationOnly false` 성공 (빈 패키지 컴파일 OK)
- [ ] `pnpm -F @seabw/defi exec pwd` 가 `packages/defi` 절대경로 반환

## 3. 롤백 방법
- `rm -rf packages/`
- `pnpm-workspace.yaml`에서 `packages/*` 라인 제거
- `tsconfig.base.json` paths 되돌리기
- `pnpm install` 재실행

---

## Scope

### 신규 생성 파일
```
packages/defi/package.json
packages/defi/tsconfig.json
packages/defi/index.ts                # 빈 export {} placeholder
packages/defi-react/package.json
packages/defi-react/tsconfig.json
packages/defi-react/index.ts
packages/defi-http/package.json
packages/defi-http/tsconfig.json
packages/defi-http/index.ts
packages/wasm-crypto/package.json
packages/wasm-crypto/tsconfig.json
packages/wasm-crypto/index.ts
```

### 수정 대상 파일
- `pnpm-workspace.yaml` — `packages/*` 추가
- `tsconfig.base.json` — 필요 시 paths 추가
- `pnpm-lock.yaml` — install 결과로 자동 갱신

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| 루트 `package.json` | 무관 | scripts 변경 없음 (`pnpm -r`로 자동 포함) |
| `apps/*` | 무관 | 아직 신규 패키지 import 없음 |

### Side Effect 위험
- 위험 1: 워크스페이스 패턴이 `apps/*` 외에 새로 추가되어 `pnpm install` 시 의도치 않은 transitive dep 변경 가능. 대응: install 후 `pnpm-lock.yaml` diff 직접 검토.

### 참고할 기존 패턴
- `apps/core/package.json` — 가장 단순한 라이브러리 패키지 골격으로 참조
- `apps/core/tsconfig.json` — extends 패턴

---

## FP/FN 검증

### False Positive (과잉)
| Scope 항목 | 구현 내용 근거 | 판정 |
|-----------|---------------|------|
| 4개 package.json | "4개 신규 워크스페이스" | ✅ OK |
| 4개 tsconfig.json | "tsconfig.json 최소 골격" | ✅ OK |
| 4개 index.ts | composite 빌드/import 검증용 placeholder | ✅ OK |
| pnpm-workspace.yaml 수정 | "packages/* 패턴 추가" | ✅ OK |

### False Negative (누락)
| 구현 내용 | Scope 포함 | 판정 |
|----------|-----------|------|
| package.json 4개 | ✅ | OK |
| tsconfig 4개 | ✅ | OK |
| pnpm-workspace.yaml | ✅ | OK |
| tsconfig.base.json paths | ✅ | OK |
| `pnpm install` 실행 | (스크립트성 작업, scope 외) | OK |

### 검증 체크리스트
- [x] Scope의 모든 파일이 구현 내용과 연결됨
- [x] 구현 내용의 모든 항목이 Scope에 반영됨
- [x] 불필요한 파일(FP) 없음
- [x] 누락된 파일(FN) 없음

### 검증 통과: ✅

---

→ 다음: [Step 02: wasm-crypto stub](step-02-wasm-crypto-stub.md)

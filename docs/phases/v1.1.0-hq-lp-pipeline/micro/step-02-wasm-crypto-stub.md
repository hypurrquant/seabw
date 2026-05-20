# Step 02: wasm-crypto stub

## 메타데이터
- **난이도**: 🟢 쉬움
- **롤백 가능**: ✅
- **선행 조건**: Step 01

---

## 1. 구현 내용

- `@seabw/wasm-crypto` 의 export 인터페이스를 HQ `@hq/wasm-crypto`와 동일하게 맞춤
- 내부 구현은 **base64 항등 함수**:
  - `encrypt(plain: string | Uint8Array): string` → `Buffer.from(input).toString('base64')`
  - `decrypt(cipher: string): Uint8Array` → `new Uint8Array(Buffer.from(cipher, 'base64'))`
  - `decryptString(cipher: string): string` → `Buffer.from(cipher, 'base64').toString('utf8')`
- 모든 export 함수에 한 줄 주석: `// SECURITY WARNING: plaintext stub for hackathon — DO NOT USE IN PRODUCTION`
- README.md (`packages/wasm-crypto/README.md`) 동일 경고 + 향후 실제 wasm 모듈 교체 시 호출부 무수정 정책 명시
- vitest 한 케이스: `decryptString(encrypt(x)) === x` 라운드 트립

## 2. 완료 조건
- [ ] `packages/wasm-crypto/index.ts` 가 `encrypt`, `decrypt`, `decryptString` 3개 함수 export
- [ ] `pnpm -F @seabw/wasm-crypto test` 통과 (라운드 트립 1 케이스)
- [ ] `rg "DO NOT USE IN PRODUCTION" packages/wasm-crypto` 가 README + index.ts 모두 hit
- [ ] `pnpm typecheck` 통과

## 3. 롤백 방법
- `git checkout HEAD -- packages/wasm-crypto/`
- 외부 의존이 없으므로 단독 롤백 안전

---

## Scope

### 신규 생성 파일
```
packages/wasm-crypto/index.ts         # encrypt/decrypt/decryptString
packages/wasm-crypto/README.md        # 경고 + 정책
packages/wasm-crypto/__tests__/round-trip.test.ts
```

### 수정 대상 파일
- `packages/wasm-crypto/package.json` — `vitest` devDependency 추가, `test` script

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| vitest | 신규 devDependency | round-trip 테스트용 |
| Node `Buffer` | 런타임 의존 | server·web 모두 호환 (Next.js polyfill) |

### Side Effect 위험
- 위험 1: web 번들에 Buffer polyfill이 필요할 수 있음. Next.js 15는 기본 polyfill하지만 edge runtime은 미지원. 대응: 호출 지점이 server-side일 가능성이 높으므로 우선 server에서만 import. Step 04/05에서 web에서 import해야 한다면 그때 대응.

### 참고할 기존 패턴
- HQ `packages/wasm-crypto/index.ts` (실제 wasm 호출) 의 export shape 그대로 따라가서 import 호환성 유지

---

## FP/FN 검증

### False Positive (과잉)
| Scope 항목 | 구현 내용 근거 | 판정 |
|-----------|---------------|------|
| index.ts | export 인터페이스 | ✅ OK |
| README.md | "README 경고" | ✅ OK |
| round-trip.test.ts | "vitest 한 케이스" | ✅ OK |

### False Negative (누락)
| 구현 내용 | Scope 포함 | 판정 |
|----------|-----------|------|
| encrypt/decrypt/decryptString | ✅ (index.ts) | OK |
| 경고 주석 | ✅ (index.ts 내부) | OK |
| 라운드트립 테스트 | ✅ | OK |
| package.json devDep 갱신 | ✅ | OK |

### 검증 통과: ✅

---

→ 다음: [Step 03: @seabw/defi-http vendor copy](step-03-defi-http-vendor.md)

# Step 03: @seabw/defi-http vendor copy

## 메타데이터
- **난이도**: 🟡 보통
- **롤백 가능**: ✅
- **선행 조건**: Step 01, 02

---

## 1. 구현 내용

HQ에서 다음 파일 복사 + import 경로 변환:

| HQ 원본 | seabw 대상 |
|---|---|
| `packages/core/lib/http.ts` | `packages/defi-http/http.ts` |
| `packages/core/lib/viem-client.ts` | `packages/defi-http/viem-client.ts` |
| `packages/core/rpc/provider.ts` | `packages/defi-http/rpc/provider.ts` |
| `packages/core/rpc/*` (provider가 import하는 것 한정) | `packages/defi-http/rpc/**` |
| `packages/core/lib/__tests__/*` (http/rpc 관련) | `packages/defi-http/__tests__/**` |

수정 작업:
- 모든 `from '@hq/...'` import를 `from '@seabw/...'` 로 일괄 치환 (codemod 또는 `find ... | xargs sed`)
  - `@hq/wasm-crypto` → `@seabw/wasm-crypto`
  - `@hq/core/lib/*` → 패키지 내부 상대 경로 또는 `@seabw/defi-http/*`
- `setHttpBaseUrl(url)` 함수가 두 base URL (LP/Lending)을 분리해서 받을 수 있도록 시그너처 확장:
  - 원본: 단일 base URL
  - v1.1.0: `setHttpBaseUrl({ lp?: string; lending?: string; default: string })` 또는 `setHttpBase('lp', url)` API
  - Lending은 v1.1.0 scope 외지만 API 시그너처는 미리 열어둠
- `packages/defi-http/index.ts` 에서 publicly 사용되는 심볼 re-export

테스트:
- HQ 원본 테스트 그대로 이식 (1~2개)
- `pnpm -F @seabw/defi-http test` 통과

## 2. 완료 조건
- [ ] `packages/defi-http/{http.ts,viem-client.ts}` 와 `rpc/provider.ts` 존재
- [ ] `rg "@hq/" packages/defi-http` → 0 hits
- [ ] `pnpm -F @seabw/defi-http build` 성공
- [ ] `pnpm -F @seabw/defi-http test` 통과
- [ ] `import { setHttpBaseUrl, getPublicClient } from '@seabw/defi-http'` 가 외부 워크스페이스에서 resolution OK (`pnpm typecheck` 통과)
- [ ] HQ wasm-crypto 호출이 모두 `@seabw/wasm-crypto`로 라우팅됨 (encrypt/decrypt 라운드트립 OK)

## 3. 롤백 방법
- `git checkout HEAD -- packages/defi-http/`
- 사용처가 아직 없으므로 단독 롤백 안전

---

## Scope

### 신규 생성 파일
```
packages/defi-http/http.ts
packages/defi-http/viem-client.ts
packages/defi-http/rpc/provider.ts
packages/defi-http/rpc/**            # provider가 의존하는 추가 파일
packages/defi-http/__tests__/*.test.ts
packages/defi-http/index.ts          # 공개 API re-export
```

### 수정 대상 파일
- `packages/defi-http/package.json` — `viem`, `zod`, `@seabw/wasm-crypto` (workspace:*) 의존성 추가

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| viem ≥ 2.48 | 신규 dependency | RPC client + chain config |
| zod | 신규 dependency | HQ http가 응답 스키마 검증에 사용 |
| @seabw/wasm-crypto | workspace dep | encrypt/decrypt 호출 |

### Side Effect 위험
- 위험 1: HQ의 http는 응답 암호화/복호화 경로가 있을 수 있음. base64 stub로 인해 평문 응답을 잘못 base64 decode 시도하면 fail. 대응: stub의 `decryptString`을 입력이 평문(`!isBase64()`)이면 그대로 반환하도록 방어 코드 추가 또는 HQ http의 분기에 "no-crypto" path 추가.
- 위험 2: `setHttpBaseUrl` 시그너처 확장이 HQ 원본 호출부와 호환 깨질 수 있음. 대응: 함수 오버로드로 기존 단일 string 시그너처도 허용.

### 참고할 기존 패턴
- HQ `packages/core/lib/http.ts:1-50` — encrypt/decrypt 호출 위치
- HQ `packages/core/lib/__tests__/http.test.ts` — 테스트 셋업 패턴

---

## FP/FN 검증

### False Positive
| Scope 항목 | 근거 | 판정 |
|---|---|---|
| http.ts | HQ 본체 | ✅ |
| viem-client.ts | HQ 본체 | ✅ |
| rpc/provider.ts | HQ 본체 | ✅ |
| __tests__/ | HQ 원본 테스트 이식 | ✅ |
| index.ts | re-export entry | ✅ |

### False Negative
| 구현 내용 | Scope 포함 | 판정 |
|---|---|---|
| HQ http.ts 복사 | ✅ | OK |
| viem-client 복사 | ✅ | OK |
| rpc provider 복사 | ✅ | OK |
| `@hq/` → `@seabw/` rename | (전 파일에서 일괄, scope 항목별로 별도 기록 안 함) | OK |
| `setHttpBaseUrl` 시그너처 확장 | ✅ (http.ts 수정) | OK |
| package.json deps | ✅ | OK |

### 검증 통과: ✅

---

→ 다음: [Step 04: @seabw/defi vendor copy](step-04-defi-vendor.md)

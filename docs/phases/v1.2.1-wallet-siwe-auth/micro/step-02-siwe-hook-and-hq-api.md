# Step 02: useSiweAuth 훅 + hq-api factory 리팩토링

## 메타데이터
- **난이도**: 🟠
- **롤백 가능**: ✅
- **선행 조건**: Step 01

## 1. 구현 내용

### A. `apps/web/src/lib/hq-api.ts` factory 리팩토링
1. `DEV_BEARER` / module-level `authHeader()` 제거.
2. `HqAuthRequiredError`, `HqUnauthorizedError` 두 클래스 export.
3. `createHqClient({ getToken: () => string | null })` factory export.
   - `authHeader()` 가 `getToken()` 호출, null 이면 `HqAuthRequiredError` throw.
   - 모든 fetch 응답이 401 이면 `HqUnauthorizedError` throw.
4. 신규 endpoints 추가:
   - `getChallenge(address)`: `GET /agent/auth/challenge?address=...` → `string`.
   - `verifySignature({ address, challenge, signature })`: `POST /agent/auth/verify` → `{ token, expiresAt }`.
   - 두 함수는 auth 헤더 **불필요**.

### B. `apps/web/src/domains/auth/use-siwe-auth.ts` 신규
- React hook. wagmi `useAccount`, `useSignMessage` + AppState dispatch 사용.
- useEffect: `useAccount.address` 변화 감지 → 동일 address 면 무시, 다른 address 면 `AUTH_RESET`, 새 address 면 `AUTH_WALLET_CONNECTED`.
- `authenticate()`: AUTH_STARTED → getChallenge → signMessageAsync → verifySignature → AUTH_VERIFIED. 에러 분기 (rejected/network/expired/server) 별 `AUTH_FAILED` dispatch.
- `signOut()`: wagmi `disconnect()` + `AUTH_RESET` + `GOTO landing`.

### C. `apps/web/src/domains/auth/hq-client-provider.tsx` 신규
- `createHqClient` 를 `useApp().state.auth.token` 으로 wiring.
- Context 노출 → `useHqClient()` 훅.

### D. `apps/web/src/domains/chat/chat.tsx` migration
- 기존 `import { createSession, chatStream, submitToolResult } from "@/lib/hq-api"` 를 `useHqClient()` 로 교체.
- 401 catch → modal trigger (window event 또는 AppState 의 `AUTH_RESET` 만으로 충분 — Stage guard 가 redirect).

## 2. 완료 조건
- [ ] `lib/hq-api.ts` 에 `Bearer dev` / `DEV_BEARER` 문자열 없음.
- [ ] `domains/auth/use-siwe-auth.ts`, `hq-client-provider.tsx` 신규.
- [ ] `chat.tsx` 가 `useHqClient` 경유.
- [ ] `pnpm typecheck` 통과.

## Scope
### 수정 대상 파일
- `apps/web/src/lib/hq-api.ts`
- `apps/web/src/domains/chat/chat.tsx`

### 신규 생성 파일
- `apps/web/src/domains/auth/use-siwe-auth.ts`
- `apps/web/src/domains/auth/hq-client-provider.tsx`

### Side Effect 위험
- 기존 module-level export 가 사라지므로 다른 import 지점 깨질 수 있음. → grep 후 정리.

## FP/FN 검증
### False Positive
- `getChallenge` / `verifySignature` 는 auth 불필요인데 같은 client 안에 둠 — auth 없이 호출 가능하게 분리. OK.

### False Negative
- 401 caught 후 모달 트리거를 안 함 → S3 시연 실패. → Step 03 에서 chat 컴포넌트가 `HqUnauthorizedError` 잡아서 `AUTH_RESET` dispatch.

### 검증 통과: ✅

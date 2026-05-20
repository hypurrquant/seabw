# Step 01: AppState 확장 (auth + Stage 재배치)

## 메타데이터
- **난이도**: 🟡
- **롤백 가능**: ✅ (단일 파일)
- **선행 조건**: 없음

## 1. 구현 내용
`apps/web/src/state/app-state.tsx` 수정:

1. `Stage` union 에서 `connect-wallet` 위치를 `survey` 앞으로:
```ts
export type Stage = "landing" | "connect-wallet" | "survey" | "tier-result" | "chat";
```

2. `AuthStatus`, `AuthState` 신규 export.

3. `AppState` 에 `auth: AuthState` 추가, `INITIAL.auth = { status: "idle" }`.

4. 신규 Action 5개:
   - `AUTH_WALLET_CONNECTED { address }`
   - `AUTH_STARTED`
   - `AUTH_VERIFIED { address, token, expiresAt }`
   - `AUTH_FAILED { error }`
   - `AUTH_RESET`

5. reducer 케이스 추가:
   - `AUTH_WALLET_CONNECTED`: 같은 address 면 무시, 다른 address 면 auth 리셋 후 status=connected.
   - `AUTH_STARTED`: status=authenticating, error=undefined.
   - `AUTH_VERIFIED`: status=authed, token/expiresAt/ownerAddress 세팅.
   - `AUTH_FAILED`: status=error, error 메시지 세팅.
   - `AUTH_RESET`: auth = { status: "idle" } 로 전체 리셋.

6. `GOTO` 액션 가드: target 이 `survey | tier-result | chat` 인데 `auth.status !== "authed"` 면 `stage = "connect-wallet"` 으로 강제 reroute.

## 2. 완료 조건
- [ ] Stage union 순서 변경 + Router switch 정상 동작 (page.tsx 의존 변경 0).
- [ ] AuthState/AuthStatus type export.
- [ ] reducer 5개 액션 처리.
- [ ] GOTO guard 동작.
- [ ] `pnpm typecheck` 통과.

## Scope
### 수정 대상 파일
- `apps/web/src/state/app-state.tsx`

### 신규 생성 파일
- 없음

### Side Effect 위험
- `Stage` 순서 변경이 `connect-wallet.tsx` 의 `useEffect` (status==="connected" 시 `GOTO chat`) 와 충돌. → 02/03 에서 함께 정리.

## FP/FN 검증
### False Positive (과잉)
- 없음.

### False Negative (누락)
- GOTO guard 가 reducer 안에서만 동작하므로, page.tsx 의 Router switch 가 직접 stage 보면 가드 우회 가능. → 03에서 Router 가 reducer 만 신뢰하므로 OK.

### 검증 통과: ✅

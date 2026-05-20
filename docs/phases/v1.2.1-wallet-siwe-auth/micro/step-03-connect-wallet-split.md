# Step 03: ConnectWallet 분리 + Providers wiring

## 메타데이터
- **난이도**: 🟠
- **롤백 가능**: ✅
- **선행 조건**: Step 02

## 1. 구현 내용

### A. `apps/web/src/domains/wallet/connect-wallet-panel.tsx` 신규 (presentational)
- props: `variant: "page" | "modal"`, `onAuthed?: () => void`.
- 내부 state: `useAccount`, `useConnect`, `useDisconnect`, `useSiweAuth`.
- UI 분기:
  - status === "disconnected" → connector 그리드 (wagmi connectors map).
  - status === "connected" + auth.status !== "authed" → "Sign in to continue" 큰 버튼 → `authenticate()` 호출.
  - auth.status === "authenticating" → spinner + "Open your wallet to sign".
  - auth.status === "authed" → checkmark + `onAuthed?.()` 호출 (또는 page variant 시 `GOTO survey`).
  - auth.status === "error" → 에러 메시지 + Retry 버튼.
- Disconnect 버튼은 항상 노출 (연결됐을 때).

### B. `apps/web/src/domains/wallet/connect-wallet-stage.tsx` 신규
- `<main>` wrapper + `<ConnectWalletPanel variant="page" onAuthed={() => dispatch({ type: "GOTO", stage: "survey" })} />`.
- 헤더 카피 + Back 버튼 (landing 으로).

### C. `apps/web/src/domains/wallet/connect-wallet-modal.tsx` 신규
- Modal/Dialog wrapper (UI 시스템에 Dialog 없으면 fixed overlay + Card 로 단순 구현).
- AppState 에 `modalOpen` 같은 슬롯 없으니 별도 context (`WalletModalContext`) — open/close 함수 export.
- 인증 중 (`auth.status === "authenticating"`) close 버튼 비활성화 (E5).
- onAuthed → 모달 close.

### D. `apps/web/src/domains/wallet/connect-wallet.tsx` (기존) deprecate
- 파일 삭제 또는 re-export 후 사용처 정리. Stage 페이지가 `ConnectWalletStage` 임포트로 바뀜.

### E. `apps/web/src/components/providers.tsx` 수정
- `WalletModalProvider` + `HqClientProvider` 추가. 트리 합성:
```tsx
<WagmiProvider>
  <QueryClientProvider>
    <AppStateProvider>
      <HqClientProvider>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </HqClientProvider>
    </AppStateProvider>
  </QueryClientProvider>
</WagmiProvider>
```

### F. `apps/web/src/app/page.tsx` Router switch 업데이트
- `case "connect-wallet": return <ConnectWalletStage />;`
- 기타 stage 그대로.
- 401 처리: chat 컴포넌트 안에서 `HqUnauthorizedError` 잡아서 `AUTH_RESET` + `WalletModalContext.open()` 호출.

## 2. 완료 조건
- [ ] 3개 신규 파일 (Panel, Stage, Modal) + 1개 Context.
- [ ] 기존 `connect-wallet.tsx` 정리 (삭제 or thin wrapper).
- [ ] Providers wiring 동작.
- [ ] `pnpm typecheck` 통과.

## Scope
### 수정 대상 파일
- `apps/web/src/domains/wallet/connect-wallet.tsx` (삭제 or 정리)
- `apps/web/src/components/providers.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/domains/chat/chat.tsx` (401 핸들러)

### 신규 생성 파일
- `apps/web/src/domains/wallet/connect-wallet-panel.tsx`
- `apps/web/src/domains/wallet/connect-wallet-stage.tsx`
- `apps/web/src/domains/wallet/connect-wallet-modal.tsx`
- `apps/web/src/domains/wallet/wallet-modal-context.tsx` (open/close)

### Side Effect 위험
- 기존 `connect-wallet.tsx` 의 useEffect (`status==='connected' → GOTO chat`) 가 새 Stage 흐름과 충돌. → 삭제.

## FP/FN 검증
### False Positive
- Modal 과 Stage 가 같은 Panel 을 쓰므로 중복 무. OK.

### False Negative
- WalletModalContext 가 누락되면 401 시 모달 못 띄움. → 06에서 시연 검증.

### 검증 통과: ✅

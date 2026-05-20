# Step 04: SiteHeader WalletBadge

## 메타데이터
- **난이도**: 🟡
- **롤백 가능**: ✅
- **선행 조건**: Step 03

## 1. 구현 내용

### A. `apps/web/src/components/wallet-badge.tsx` 신규
- props: 없음 (모든 state 는 hook 으로).
- `useAccount`, `useApp().state.auth`, `useWalletModal()`, `useSiweAuth().signOut`.
- UI 분기:
  - auth.status === "authed" → `truncateAddress(address)` 칩 + dropdown ⌄ → "Sign out".
  - auth.status === "connected" → "Sign in" 버튼 → `walletModal.open()`.
  - else (idle/error) → "Connect wallet" 버튼 → `walletModal.open()`.

### B. `apps/web/src/components/site-header.tsx` 수정
- 우측 nav 옆에 `<WalletBadge />` 노출.
- 배지가 항상 노출 (stage 무관).

## 2. 완료 조건
- [ ] WalletBadge 컴포넌트 신규.
- [ ] SiteHeader 에 추가.
- [ ] status 별 시각적 분기 동작 (수동 확인).
- [ ] `pnpm typecheck` 통과.

## Scope
### 수정 대상 파일
- `apps/web/src/components/site-header.tsx`

### 신규 생성 파일
- `apps/web/src/components/wallet-badge.tsx`

### Side Effect 위험
- 없음 (헤더 슬롯 추가 only).

## FP/FN 검증
### False Positive
- 없음.

### False Negative
- dropdown 라이브러리 없음 — 단순 details/summary 또는 custom popover 로 충분. OK.

### 검증 통과: ✅

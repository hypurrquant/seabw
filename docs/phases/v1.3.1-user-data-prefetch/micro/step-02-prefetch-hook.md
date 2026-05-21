# Step 02: prefetch hook

## 메타데이터
- **난이도**: 🟡
- **선행 조건**: Step 01

## 구현 내용
- 신규 파일 `apps/web/src/domains/positions/use-prefetch-user-data.ts`.
- `usePrefetchUserData(owner: 0x.. | undefined): { status, retry, error? }`.
- 내부 동작:
  1. `ensurePools()` (pool list resolve)
  2. `refreshAll(owner, [])` (모든 체인 known tokens balance)
  3. SUPPORTED_CHAINS 각각: pools 추출 → `fetchPositionsByChain(owner, chainId, pools)`
  4. 단계별 console.info 로그.
- owner 가 바뀌면 자동 재실행.
- 에러 시 status="error", retry() 로 재시도 가능.

## 완료 조건
- [ ] owner 주어지면 자동 prefetch 시작.
- [ ] status: idle → loading → ready / error 전이.
- [ ] 콘솔 단계별 로그 출력.

## Scope
### 신규 생성
- `apps/web/src/domains/positions/use-prefetch-user-data.ts`

# Step 03: .env.example 갱신

## 메타데이터
- **난이도**: 🟡 / **롤백**: ✅

## 구현 내용
- 루트 `.env.example` 수정:
  - 추가: `NEXT_PUBLIC_HQ_ORIGIN=http://localhost:3003`, `NEXT_PUBLIC_HQ_BASE_URL=http://localhost:3003/api/v1`
  - 제거: `DEFI_PRIVATE_KEY=` (audit 후, grep 0 확인)
  - 주석 추가: prod 강제 변수 4종 (NEXT_PUBLIC_DEFIPILOT_ENV=prod, DEFIPILOT_DEMO_BANNER=false, NEXT_PUBLIC_DEFAULT_CHAIN_ID=999, HYPEREVM_RPC_URL 필수)
  - 변수 그룹화: HQ 관련 / wallet / chain / defipilot env / RPC.

## 완료 조건
- [ ] `NEXT_PUBLIC_HQ_ORIGIN` 추가 (F11)
- [ ] `NEXT_PUBLIC_HQ_BASE_URL` 추가 (F12)
- [ ] `DEFI_PRIVATE_KEY` 제거 (F13, audit 후)
- [ ] prod 강제 주석 (F14)

## Scope
- 수정: `.env.example`
- Audit: `grep "DEFI_PRIVATE_KEY" apps/web/src` → 0 hits 확인 후 제거

## FP/FN 검증
- FP: 없음
- FN: server-only env (DEFI_PRIVATE_KEY 가 server 측에서 사용될 가능성) — apps/server 가 없어서 해당 없음. apps/web src grep 0 이면 안전
- 검증 통과: ✅

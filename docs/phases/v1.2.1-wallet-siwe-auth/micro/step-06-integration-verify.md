# Step 06: 통합 검증

## 메타데이터
- **난이도**: 🟢
- **롤백 가능**: ✅ (코드 미변경)
- **선행 조건**: Step 01~05

## 1. 구현 내용
검증만 수행. 코드 변경 없음.

### A. 자동 검증
```bash
cd /Users/mousebook/Documents/hypurrquant/seabw
pnpm typecheck       # apps/web strict tsc
pnpm build           # next build
```

### B. dev-bypass 거부 확인
```bash
curl -i -X POST http://localhost:3003/api/v1/agent/sessions \
  -H "Authorization: Bearer dev" \
  -H "Content-Type: application/json" \
  -d '{}'
# 기대: HTTP/1.1 401
```

### C. 수동 시연 (dod.md S1~S7)
- S1 행복 경로 — landing → connect-wallet → MetaMask connect → Sign in → survey → tier → chat. HQ mongo `agent_sessions.owner === wagmi.address` 확인.
- S2 서명 거부.
- S3 토큰 만료 강제.
- S4 계정 스위치.
- S5 dev-bypass 거부 (위 B).
- S6 네트워크 차단.
- S7 CORS 헤더 확인.

### D. 산출물 정리
- PROGRESS.md → 모든 step ✅ 완료.
- CLAUDE.md → v1.2.1 "✅ 완료" + 시작/완료일.

## 2. 완료 조건
- [ ] `pnpm typecheck` 통과.
- [ ] `pnpm build` 통과.
- [ ] S5 (dev-bypass 401) 통과.
- [ ] S1~S4, S6 시연 노트 작성 (사용자 직접 확인).
- [ ] CLAUDE.md / PROGRESS.md 갱신.

## Scope
### 수정 대상 파일
- `docs/phases/v1.2.1-wallet-siwe-auth/PROGRESS.md`
- `CLAUDE.md`

### 신규 생성 파일
- 없음

### Side Effect 위험
- 없음.

## FP/FN 검증
### False Positive
- 자동 검증만으로는 UI/지갑 상호작용 못 잡음 → 수동 시연 필수.

### False Negative
- E2E 스크립트 없음 — 사용자 직접 brwoser 시연.

### 검증 통과: ✅

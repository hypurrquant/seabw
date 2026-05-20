# Step 17: system prompt 갱신 + E2E preflight + 빌드/typecheck 최종 검증

## 메타데이터
- **난이도**: 🟢
- **롤백 가능**: ✅
- **선행 조건**: Step 11~16

## 1. 구현 내용

### A. `docs/seabw-system-prompt.md` 갱신
design.md §13 그대로. 마지막에 "## Tool 사용 규칙 (CRITICAL)" 섹션 추가:
- 흐름: get_wallet_status → get_pools/get_pool_detail → get_token_prices → (선택) calculate_optimal_range → propose_lp_positions.
- propose_lp_positions 없이 텍스트만으로 LP 추천 금지.
- tier hard limits.
- generatedAt 보내지 말 것.
- LpCard.recipe 예시 1건 (mint atom).

### B. 환경 preflight (수동)
- 데모 chain (hyperEvm 999 또는 base 8453) 에 mint 가능한 pool 1개 확보.
- 데모 지갑 native gas + LP pair token 잔고 확인.
- HQ 컨테이너 재기동 후 새 chat 세션으로 LLM `list tools` 호출 → `propose_lp_positions` 포함 확인.

### C. 자동 검증 일괄
```bash
cd /Users/mousebook/Documents/hypurrquant/seabw
pnpm typecheck                    # exit 0
pnpm build                        # exit 0
pnpm test                          # vitest LpProposalSchema + guardRecipe + store
curl -fsS "http://localhost:3003/api/v1/agent/auth/challenge?address=0x1234567890123456789012345678901234567890"
curl -i -X OPTIONS -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST" http://localhost:3003/api/v1/agent/sessions 2>&1 | grep -i access-control-allow-origin
```

### D. E2E S0 시연 (수동)
1. `pnpm dev`
2. 새 시크릿 탭 → `:3000`
3. Connect wallet to start → MetaMask → Sign in (SIWE)
4. survey → tier
5. AI와 대화 시작 → chat 자동 첫 메시지
6. devtools Network 탭 — `/agent/chat` SSE 정상, `/api/v1/api/v1/...` 더블 prefix 0
7. LLM tool_call 진행 → propose_lp_positions 까지
8. LP 카드 3장 렌더 확인
9. 카드 1개 클릭 → Pipeline Ready 카드 표시
10. Execute → wagmi 서명 popup → tx hash 표시

### E. PROGRESS.md / CLAUDE.md 갱신
- 2차 모든 step ✅ 완료.
- CLAUDE.md `현재 페이즈` 의 상태를 "✅ 완료" + 완료일.

## 2. 완료 조건
- [ ] system prompt §Tool 사용 규칙 추가
- [ ] `pnpm typecheck` ✅
- [ ] `pnpm build` ✅
- [ ] `pnpm test` 관련 케이스 ✅
- [ ] challenge curl 200
- [ ] CORS preflight `access-control-allow-origin: http://localhost:3000`
- [ ] E2E S0 path 1회 성공 (수동)
- [ ] PROGRESS.md / CLAUDE.md 갱신

## Scope
### 수정 파일
- `docs/seabw-system-prompt.md`
- `docs/phases/v1.2.1-wallet-siwe-auth/PROGRESS.md`
- `CLAUDE.md`

### 신규 파일
- 없음

### Side Effect 위험
- 없음.

## FP/FN
### FP
- 없음.

### FN
- 데모 환경의 pool 부재 / 지갑 잔고 부족 → 시연 중단. preflight 에서 잡힘.

검증 통과: ✅

# Step 05: Smoke + 문서 갱신

## 메타데이터
- **난이도**: 🟡 보통
- **선행 조건**: Step 01~04 모두 완료

## 구현 내용

### A. 통합 smoke 시나리오
1. HQ worktree 부팅: `cd /Users/.../HypurrQuant_FE/worktrees/seabw-integration && AGENT_SYSTEM_PROMPT_FILE=/Users/.../seabw/docs/seabw-system-prompt.md pnpm dev:server`
2. seabw server 부팅: `pnpm dev:server` (placeholder OK)
3. seabw web 부팅: `pnpm dev:web`
4. 브라우저 `http://localhost:3000` (또는 seabw web 포트) 접속
5. landing → survey 완료 → tier-result → chat 진입
6. 첫 user message에 tendency markdown이 자동 발송되었는지 network tab 확인
7. AI가 LP 풀 정보를 응답하는지 확인
8. (선택) "mint 진행" 의사 표시 후 wagmi 서명 모달 뜨고 mocked wallet으로 서명, step-complete 호출 확인

### B. 문서 갱신
- `CLAUDE.md`
  - "현재 페이즈" → v1.1.0 ✅ 완료
  - "구조" 트리 — domains 5개 → 없음으로 축소, web stage 명세 갱신
  - "부팅" — HQ 부팅 명령 추가, defi-cli 안내 제거
- `docs/phases/v1.1.0-hq-backbone/PROGRESS.md` — Step 3 ✅ 완료
- `README.md` (루트, 있다면) 동일 갱신

### C. 검증
- DoD 표 전 항목 grep/build/manual 통과
- `pnpm typecheck && pnpm lint && pnpm -r build && pnpm -r test` 통과

## 완료 조건
- [ ] Smoke 시나리오 1~7 통과 (manual)
- [ ] DoD 표 1~15 모든 항목 ✅
- [ ] 기본 검증 (typecheck/lint/build) ✅
- [ ] CLAUDE.md / PROGRESS.md 갱신
- [ ] (선택) `e2e/v1.1.0-smoke.spec.ts` Playwright 시나리오 추가

# Step 06: env + 문서 + smoke

## 메타데이터
- **난이도**: 🟡
- **선행 조건**: Step 01~05

## 구현 내용
1. `apps/web/.env.local.example` 신규/갱신:
   - `NEXT_PUBLIC_HQ_BASE_URL=http://localhost:3001`
   - `NEXT_PUBLIC_HQ_DEV_BEARER=dev`
2. CLAUDE.md 갱신:
   - 현재 페이즈 → v1.2.0 (또는 진행중/완료)
   - 부팅 안내에 HQ env 명시 (`AGENT_SYSTEM_PROMPT_FILE`, `AGENT_AUTH_DEV_BYPASS`)
3. PROGRESS.md Step 5 ✅
4. Smoke:
   - HQ worktree dev 부팅 + seabw dev 부팅
   - landing → survey → tier-result → connect-wallet → chat
   - 좌측 report, 우측 chat 확인
   - 첫 메시지 자동 발송 + AI 응답
   - tool_call 발생해도 앱 죽지 않음

## 완료 조건
- [ ] DoD N1~N7 모두 통과
- [ ] DoD 표 전 항목 ✅

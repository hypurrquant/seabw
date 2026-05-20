# Step 05: HQ 컨테이너 정리 (guard 분기 삭제 + env + compose + 재기동)

## 메타데이터
- **난이도**: 🟠
- **롤백 가능**: ✅ (git revert + env 복구 + compose restart)
- **선행 조건**: 없음 (web side 와 병렬 가능)

## 1. 구현 내용

작업 위치: `/Users/mousebook/Documents/side-project/HypurrQuant_FE/worktrees/seabw-integration/`

### A. `apps/server/src/domains/agent/interface/agent-auth.guard.ts` 수정
- 22-26 line 의 `if (process.env['AGENT_AUTH_DEV_BYPASS'] === '1') { ... return true; }` 분기 **삭제**.
- 정상 SIWE 토큰 검증 흐름만 남김.

### B. `apps/server/.env.local` 수정
- `AGENT_AUTH_DEV_BYPASS=1`, `AGENT_AUTH_DEV_WALLET` 라인 추가 안 함 (현재도 없음 — 그대로 유지).
- `CORS_ORIGIN` 에 `http://localhost:3000` 추가 (현재: `https://app.hypurrquant.com,http://localhost:3002` → 변경: `...:3002,http://localhost:3000`).
- `AGENT_SYSTEM_PROMPT_FILE=/seabw/seabw-system-prompt.md` 추가.

### C. `apps/server/docker-compose.local.yml` 수정
- `api.volumes` 에 system prompt 마운트 1줄 추가:
```yaml
- /Users/mousebook/Documents/hypurrquant/seabw/docs/seabw-system-prompt.md:/seabw/seabw-system-prompt.md:ro
```

### D. 컨테이너 재기동
```bash
cd /Users/mousebook/Documents/side-project/HypurrQuant_FE/worktrees/seabw-integration/apps/server
docker compose -f docker-compose.local.yml up -d --force-recreate api
```

### E. `[seabw]` commit
- 위 변경 모두 `feat/seabw-integration` 브랜치에 단일 commit.
- 메시지: `[seabw] auth: remove dev-bypass, mount system prompt, allow :3000 CORS`.

## 2. 완료 조건
- [ ] guard 의 dev-bypass 분기 코드 삭제.
- [ ] `.env.local` CORS + SYSTEM_PROMPT_FILE 갱신.
- [ ] docker-compose 에 system prompt mount 추가.
- [ ] `pnpm --filter hypurrquant-fe-server build` 통과 (또는 컨테이너 rebuild 성공).
- [ ] 컨테이너 재기동.
- [ ] `curl -X POST :3003/api/v1/agent/sessions -H 'Authorization: Bearer dev' -d '{}'` → 401.

## Scope
### 수정 대상 파일
- `apps/server/src/domains/agent/interface/agent-auth.guard.ts`
- `apps/server/.env.local`
- `apps/server/docker-compose.local.yml`

### 신규 생성 파일
- 없음

### Side Effect 위험
- HQ guard 변경이 다른 통합 컨테이너 영향 → seabw-integration worktree 격리되므로 OK.
- 기존 `Bearer dev` 로 호출하던 외부 스크립트 깨짐 → seabw 외 호출자 없음으로 가정.

## FP/FN 검증
### False Positive
- 없음.

### False Negative
- `docker compose up -d --force-recreate` 가 env_file 변경을 안 읽으면 `down` 필요. → 안전하게 `down api && up -d api`.

### 검증 통과: ✅

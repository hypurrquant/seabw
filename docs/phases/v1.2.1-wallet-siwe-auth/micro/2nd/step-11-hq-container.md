# Step 11: HQ worktree — MCP schema + docker-compose CORS + 컨테이너 재기동

## 메타데이터
- **난이도**: 🟠
- **롤백 가능**: ✅ (git revert + docker compose restart)
- **선행 조건**: 없음 (seabw side 와 병렬 가능)

## 1. 구현 내용

작업 경로: `/Users/mousebook/Documents/side-project/HypurrQuant_FE/worktrees/seabw-integration`

### A. `apps/server/tools/hypurrquant-mcp-server.ts` — `propose_lp_positions` schema 추가
- 위치: 기존 marker `// ─── Calculation Tools ──` 끝 또는 마지막에.
- 카드 LpCardSchemaMcp (id, rank 1/2/3, protocol, chainId, pair, poolAddress, metrics, position, reasoning, recipe).
- `server.tool('propose_lp_positions', description, { cards: z.tuple([...,...,...]), rationale: z.string() }, (args) => callTool(...))`.
- generatedAt 은 args 에 포함 안 함 (handler 가 자동 채움).

### B. `apps/server/docker-compose.local.yml` — `environment.CORS_ORIGIN` 에 `http://localhost:3000` 추가
- 현재: `CORS_ORIGIN: http://localhost:3002,https://app.hypurrquant.com,https://test.hypurrquant.com`
- 변경: 위 + `,http://localhost:3000`

### C. 컨테이너 재기동
```bash
cd apps/server
docker compose -f docker-compose.local.yml up -d --build api
```

### D. 검증
```bash
# 코드 schema 등록 확인
rg "propose_lp_positions" apps/server/tools/hypurrquant-mcp-server.ts
# 컨테이너 환경 확인
docker inspect hq-api --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -i cors_origin
# challenge 정상
curl -fsS "http://localhost:3003/api/v1/agent/auth/challenge?address=0x1234567890123456789012345678901234567890"
# CORS preflight
curl -i -X OPTIONS -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST" http://localhost:3003/api/v1/agent/sessions 2>&1 | grep -i access-control-allow-origin
```

### E. `[seabw]` commit
- 메시지: `[seabw] tools: add propose_lp_positions MCP schema + CORS :3000`

## 2. 완료 조건
- [ ] schema 등록 (rg 1건)
- [ ] CORS env 변경 (rg 1건)
- [ ] 컨테이너 healthcheck OK
- [ ] challenge curl 200
- [ ] preflight CORS 헤더 OK
- [ ] codex 새 chat 1회 띄워 LLM `list available tools` 에 `propose_lp_positions` 포함 확인 (수동)
- [ ] `[seabw]` commit

## Scope
### 수정 파일
- HQ worktree `apps/server/tools/hypurrquant-mcp-server.ts`
- HQ worktree `apps/server/docker-compose.local.yml`

### 신규
- 없음

### Side Effect 위험
- 다른 worktree 영향 없음 (격리됨)

## FP/FN
### FP
- 없음

### FN
- LpCardSchemaMcp 필드가 seabw 측 LpCardSchema 와 drift 가능 → 두 파일이 매핑되는 표 (id/rank/protocol/chainId/pair/poolAddress/metrics/position/reasoning/recipe) 코드에 명시.

검증 통과: ✅

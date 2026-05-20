# Step 06: HQ MCP tool 등록 + system prompt + 통합 smoke

## 메타데이터
- **난이도**: 🟠 중간
- **롤백 가능**: ✅ (HQ commit revert + system prompt 절 삭제)
- **선행 조건**: Step 01~05 모두 완료 (web side 가 받을 수 있는 상태)

---

## 1. 구현 내용 (design.md 기반)

### (A) HQ MCP tool 등록 — worktree `feat/seabw-integration`

- `/Users/mousebook/Documents/side-project/HypurrQuant_FE/worktrees/seabw-integration/apps/server/tools/hypurrquant-mcp-server.ts` 수정
- `server.tool('propose_lp_positions', description, argsSchema, handler)` 1건 추가
- argsSchema: design.md API 섹션 참조 — `proposal: { cards: z.tuple([..., ..., ...]), rationale: string }`
- description: "Propose exactly 3 LP position candidates to the user. The user will see a modal with 3 cards and select one. Use this whenever the user asks for LP recommendations. rank=1 is your top recommendation; 2 and 3 are alternatives."
- handler: `(args) => callTool('propose_lp_positions', args)` (기존 패턴)
- HQ worktree commit prefix `[seabw]`
- HQ build 통과 (`pnpm --filter hypurrquant-fe-server build`)
- HQ 컨테이너 재기동 (또는 dev 모드 재시작)

### (B) System prompt 갱신

- `docs/seabw-system-prompt.md` 에 신규 절 "LP 추천 규약" 추가:
  - LP 추천 요청 시 반드시 `propose_lp_positions` tool 사용
  - `cards` 는 정확히 3장
  - `rank: 1` = AI 의 최고 추천, 2/3 = 대안
  - tier 한도 가드 (preservation 에 degen 카드 금지 등)
  - `[Selection] I choose option N.` 메시지 수신 시 → cards[N-1] 의 recipe 로 즉시 `compose_pipeline` tool 호출
  - 각 카드의 `reasoning.fitForTier` / `pros` / `cons` 채움
  - few-shot 예시 1건 포함 (balanced tier 사용자에게 carbon/aggressive 1장씩)

### (C) 통합 smoke (DoD 비기능)

- `pnpm typecheck` / `pnpm build` / `pnpm lint` / `pnpm test` (seabw)
- HQ worktree build
- **S1 시연** (수동, 행복 경로):
  1. HQ 컨테이너 + seabw dev 부팅 (CLAUDE.md 부팅 절차)
  2. landing → connect-wallet → SIWE → survey → tier-result → chat
  3. chat 에 "내 성향에 맞는 LP 3개 추천해줘"
  4. AI 가 `propose_lp_positions` tool_call 발행 → 모달 자동 오픈
  5. rank 1 카드 강조, 3장 모두 protocol/pair/APR/TVL/IL/pros/cons/tierAlignment 표시
  6. 카드 2 클릭 → 모달 닫힘 → `[Selection] I choose option 2.` 메시지가 chat 에 표시
  7. AI 가 cards[1].recipe 로 `compose_pipeline` 호출 → `<PipelinePreviewModal/>` 자동 오픈
  8. 승인 → wagmi 서명 → 온체인 LP 진입
- **S2 시연** (수동): 카드 표시 중 새 메시지 입력 → 모달 즉시 사라짐
- **CLAUDE.md 갱신**: 현재 페이즈를 v1.3.0 "✅ 완료" 로 교체, v1.2.1 을 이전 페이즈로 이동 (v1.2.1 2차 완료 가정).

## 2. 완료 조건 ⚠️

- [ ] HQ MCP server 에 `propose_lp_positions` 등록 (DoD F20: grep 1+ hit)
- [ ] HQ MCP cards 가 `z.tuple([..., ..., ...])` (DoD F21)
- [ ] HQ worktree commit prefix `[seabw]` (DoD F22)
- [ ] `docs/seabw-system-prompt.md` 에 "LP 추천 규약" 절 추가 + few-shot 1건 (DoD F23)
- [ ] HQ build 통과 (DoD N5)
- [ ] seabw `pnpm typecheck` / `build` / `lint` / `test` 통과 (DoD N1~N4)
- [ ] S1 행복 경로 수동 시연 통과
- [ ] S2 새 메시지 시 카드 제거 시연 통과
- [ ] E1 (카드 4개) — AI args 강제 조작으로 fallback 확인 또는 skip 사유 기록
- [ ] CLAUDE.md "현재 페이즈" 갱신 (DoD N8)
- [ ] PROGRESS.md 모든 Step ✅ (DoD N9)

## 3. 롤백 방법

- HQ: `git -C <worktree> revert <commit>` + 컨테이너 재기동
- system prompt: `docs/seabw-system-prompt.md` 의 절 1개 삭제 → HQ 재기동
- 영향 범위: HQ MCP 에서 tool 제거 — LLM 이 호출 안 함. UI 는 이미 mount 돼 있어도 store 변화 없어 모달 안 뜸.

---

## Scope

### 수정 대상 파일
```
/Users/mousebook/Documents/side-project/HypurrQuant_FE/worktrees/seabw-integration/
└── apps/server/tools/hypurrquant-mcp-server.ts    # 수정 - tool 1개 추가

docs/
├── seabw-system-prompt.md     # 수정 - LP 추천 규약 절 추가
└── (CLAUDE.md)                 # 수정 - 현재 페이즈 갱신
```

### 신규 생성 파일
없음.

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| HQ MCP server | 직접 수정 | tool 등록 |
| system prompt | 직접 수정 | LLM 행동 가이드 |
| HQ 컨테이너 | 재기동 필요 | env 또는 코드 변경 후 |

### Side Effect 위험
- **risk 1**: HQ MCP 변경이 다른 통합 컨테이너 영향 — worktree 격리 (v1.2.1 1차 정책).
- **risk 2**: system prompt 가 너무 강한 지시문이면 다른 일반 대화에서도 LP 추천만 하려 함 — few-shot 으로 "사용자가 LP 추천을 요청할 때만" 조건 강조.
- **risk 3**: HQ 컨테이너 재기동 절차 잘못 → `Bearer dev` 부활 같은 회귀 — v1.2.1 1차 운영 절차 그대로.

### 참고할 기존 패턴
- HQ `apps/server/tools/hypurrquant-mcp-server.ts` 기존 26개 tool 등록 패턴.
- `docs/seabw-system-prompt.md` v1.2.0 작성 본 (DefiPilot 페르소나).

---

## FP/FN 검증

### False Positive (과잉)
| Scope 항목 | 구현 내용 근거 | 판정 |
|-----------|---------------|------|
| HQ MCP server 수정 | propose_lp_positions 등록 | ✅ OK |
| system prompt 수정 | LP 추천 규약 + few-shot | ✅ OK |
| CLAUDE.md 수정 | 현재 페이즈 갱신 (DoD N8) | ✅ OK |

### False Negative (누락)
| 구현 내용 | Scope 포함 | 판정 |
|----------|-----------|------|
| MCP tool 등록 | ✅ HQ server | OK |
| zod tuple (정확히 3개) | ✅ HQ server schema | OK |
| system prompt 규약 절 | ✅ docs/seabw-system-prompt.md | OK |
| few-shot 예시 1건 | ✅ system prompt 안 | OK |
| S1 시연 / S2 시연 | ✅ 완료 조건 체크박스 | OK |
| CLAUDE.md 갱신 | ✅ Scope 포함 | OK |
| PROGRESS.md 갱신 | ✅ 완료 조건 | OK |

### 검증 통과: ✅

---

→ 다음: Phase 완료 (Complete)

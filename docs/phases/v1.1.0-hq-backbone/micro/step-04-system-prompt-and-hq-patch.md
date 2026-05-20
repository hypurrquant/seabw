# Step 04: System prompt + HQ env hook 패치

## 메타데이터
- **난이도**: 🟡 보통 (외부 레포 패치 포함)
- **선행 조건**: 없음 (병렬 가능)

## 구현 내용

### A. seabw 페르소나 작성
- `docs/seabw-system-prompt.md` 신규 작성
- 내용:
  - "당신은 seabw입니다. 사용자의 KOFIA 기반 설문 분석 결과를 받아 LP 풀을 개인화 추천하는 도우미입니다."
  - 가용한 MCP tool 안내(LP pools query, recipe compose, pipeline 등 — HQ의 tool 이름과 정합)
  - 응답 톤 (친절·구체적·근거 제시)
  - 단위 메모 (LP=APR)
  - 안전 가이드 (서명·자금 강요 금지, 사용자 확인 후 실행)
- 길이 2~4KB 권장

### B. HQ 패치 (worktree `feat/seabw-integration`)
- 위치: `/Users/mousebook/Documents/side-project/HypurrQuant_FE/worktrees/seabw-integration`
- HQ의 agent system prompt 빌더 위치 식별 (`apps/server/src/domains/agent/.../system-prompt*.ts` 또는 동등)
- 변경:
  ```ts
  import * as fs from 'fs';
  const DEFAULT_SYSTEM_PROMPT = "<기존 HQ 기본>";
  export function getSystemPrompt(): string {
    const path = process.env.AGENT_SYSTEM_PROMPT_FILE;
    if (path) {
      try { return fs.readFileSync(path, 'utf8'); }
      catch (err) { console.warn(`AGENT_SYSTEM_PROMPT_FILE read failed: ${(err as Error).message}`); }
    }
    if (process.env.AGENT_SYSTEM_PROMPT) return process.env.AGENT_SYSTEM_PROMPT;
    return DEFAULT_SYSTEM_PROMPT;
  }
  ```
- worktree에서 commit: `[seabw] agent: AGENT_SYSTEM_PROMPT_FILE/AGENT_SYSTEM_PROMPT env hook`

### C. HQ 부팅 가이드
- seabw 측 README/CLAUDE.md에 HQ 부팅 명령 추가:
  ```bash
  cd /Users/.../HypurrQuant_FE/worktrees/seabw-integration
  pnpm install
  AGENT_SYSTEM_PROMPT_FILE=/Users/.../seabw/docs/seabw-system-prompt.md \
    pnpm dev:server
  ```

## 완료 조건
- [ ] DoD 10 충족: HQ worktree에 `AGENT_SYSTEM_PROMPT_FILE` env hook commit
- [ ] DoD 11 충족: `docs/seabw-system-prompt.md` 존재
- [ ] HQ worktree에서 `pnpm build` exit 0 (회귀 없음)
- [ ] HQ에 `AGENT_SYSTEM_PROMPT_FILE=<경로>` 로 부팅 시 stdout 로그에 "seabw" persona 로드 확인

## Scope

### 수정 (worktree)
- HQ `apps/server/src/domains/agent/.../system-prompt*.ts` (또는 동등)
- HQ `apps/server/.env.example` — env 항목 안내 (선택)

### 신규 (seabw)
- `docs/seabw-system-prompt.md`

### 커밋 prefix
- HQ worktree 커밋: `[seabw] ...`

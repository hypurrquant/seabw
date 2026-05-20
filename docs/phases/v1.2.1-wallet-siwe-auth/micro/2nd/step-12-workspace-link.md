# Step 12: workspace cross-directory link + `@hq/react`/`@hq/core` 의존 추가

## 메타데이터
- **난이도**: 🟠
- **롤백 가능**: ✅ (git revert + pnpm install)
- **선행 조건**: 없음

## 1. 구현 내용

### A. `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "../../side-project/HypurrQuant_FE/worktrees/seabw-integration/packages/*"
```

### B. `apps/web/package.json` `dependencies` 에 추가
```jsonc
{
  "@hq/react": "workspace:*",
  "@hq/core": "workspace:*",
  "zustand": "^4.5.7"
}
```

### C. `pnpm install`
- 10분 이내 완료 기대 (HQ packages 의 zerodev 등 무거운 deps 포함).
- 실패 시 R1 fallback (file: 단건 link).

### D. peerDep 충돌 회피
- HQ `@hq/react` peerDep `react: ^18` vs seabw `react: 19`.
- `pnpm install` 시 warning 만 발생해야 (error 0).
- error 발생 시: HQ worktree `packages/react/package.json` 의 peerDeps 를 `^18 \|\| ^19` 로 패치 (별 commit `[seabw]`).

### E. import 가능성 검증
```ts
// 임시 파일에 작성 후 typecheck 만 통과시키고 다시 제거
import { useAgentChat, useAgentStore, usePipelineStore } from "@hq/react/agent";
import { initPlatformDeps } from "@hq/react/platform";
import { previewRecipe, executeRecipe } from "@hq/react/defi/pipeline";
import { setHttpBaseUrl } from "@hq/core/lib/http";
import type { RecipeAtom } from "@hq/core/defi/pipeline/types";
```

## 2. 완료 조건
- [ ] `pnpm-workspace.yaml` 수정
- [ ] `apps/web/package.json` deps 3개 추가
- [ ] `pnpm install` 성공 (10분 이내, error 0)
- [ ] `ls apps/web/node_modules/@hq/{react,core}/package.json` 둘 다 OK
- [ ] 위 §E import 들이 `pnpm typecheck` 통과

## Scope
### 수정 파일
- `pnpm-workspace.yaml`
- `apps/web/package.json`
- (필요 시) HQ worktree `packages/react/package.json` peerDep 패치

### 신규
- `pnpm-lock.yaml` 업데이트

### Side Effect 위험
- HQ packages 의 transitive deps (zerodev, viem 등) 가 seabw 번들 사이즈 영향. tree-shake 의존.

## FP/FN
### FP
- 없음.

### FN
- HQ packages 가 cjs 만 export 하는 경우 next.js esm 호환 깨질 가능성 → Step 5A 초기에 빌드 verify.

검증 통과: ✅

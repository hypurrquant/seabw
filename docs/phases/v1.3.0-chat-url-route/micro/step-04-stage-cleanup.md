# Step 04: stage cleanup

## 메타데이터
- **난이도**: 🟢
- **선행 조건**: Step 03

## 구현 내용
- `state/app-state.tsx`:
  - `Stage` 유니온에서 `"chat"` 제거.
  - `PROTECTED_STAGES` set 에서 `"chat"` 제거.
- `app/page.tsx`:
  - `case "chat"` 블럭 삭제.
- TypeScript 가 다른 `"chat"` 참조를 잡으면 모두 정리.

## 완료 조건
- [ ] `grep -r 'stage:.*"chat"' apps/web/src` 결과 0.
- [ ] `pnpm typecheck` 통과.

## Scope
### 수정 대상
- `apps/web/src/state/app-state.tsx`
- `apps/web/src/app/page.tsx`

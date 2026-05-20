# Step 02: apps/server placeholder 정리

## 메타데이터
- **난이도**: 🟢 쉬움
- **선행 조건**: Step 01

## 구현 내용

seabw apps/server를 **부팅만 되는 placeholder**로 축소.

### 작업
1. `apps/server/src/app.module.ts` — imports 배열을 `[]`로 (또는 ConfigModule만 남김)
2. `apps/server/package.json` — defi-cli, anthropic, openai 등 옛 도메인 의존성 제거
3. `apps/server/src/bootstrap/main.ts` — 그대로 유지 (NestFactory + cors + ValidationPipe)
4. `apps/server/src/common/` — ApiResponse helper만 유지 (다른 도메인에서 안 써도 향후 확장 위해 보존)
5. `apps/server/src/lib/ratelimit.ts` — 유지 (제네릭 유틸)
6. `apps/server/src/__tests__/` — 도메인 의존 spec은 Step 01에서 정리됨, 남은 게 있으면 정리

### Health 엔드포인트 (선택)
- `apps/server/src/health.controller.ts` 작성 → `/health` GET → `{status:'ok'}`
- 부팅 확인용

## 완료 조건
- [ ] DoD 4 충족: `apps/server/src/domains/` 비어 있음 (또는 README만)
- [ ] DoD 5 충족: app.module의 imports가 빈 배열 또는 health만
- [ ] DoD 6 충족: `pnpm -F @seabw/server build` exit 0
- [ ] `pnpm dev:server` 부팅 OK
- [ ] `pnpm-lock.yaml` 에서 defi-cli 관련 dep 감소

## Scope

### 수정
- `apps/server/src/app.module.ts`
- `apps/server/package.json` (의존성 제거)
- `apps/server/src/bootstrap/main.ts` (필요 시 minor)

### 신규
- `apps/server/src/health.controller.ts` (선택)
- `apps/server/src/health.module.ts` (선택)

### 삭제
- `apps/server/src/domains/` (디렉토리가 비었으면 통째 제거 가능)

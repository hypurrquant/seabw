# Step 03: NestJS 서버 부트스트랩

## 메타데이터
- **난이도**: 🟡 보통
- **롤백 가능**: ✅
- **선행 조건**: Step 02

---

## 1. 구현 내용

`apps/server`를 NestJS 11 + SWC 빌더로 부팅 가능 상태까지.

- `apps/server/package.json`:
  - dependencies: `@nestjs/common@^11`, `@nestjs/core@^11`, `@nestjs/platform-express@^11`, `reflect-metadata`, `rxjs`, `zod`, `@seabw/core: workspace:*`, `class-validator`, `class-transformer`
  - devDependencies: `@nestjs/cli@^11`, `@nestjs/testing@^11`, `@swc/core`, `@swc/cli`, `@types/express`, `@types/node`, `typescript`, `vitest`, `supertest`, `@types/supertest`, `unplugin-swc`
  - scripts: `build`, `start`, `start:dev`, `test` (`vitest run`)
- `apps/server/nest-cli.json`:
  - sourceRoot `src`, entryFile `bootstrap/main`, builder `swc`, typeCheck true
- `apps/server/tsconfig.json`: extends base, `experimentalDecorators: true`, `emitDecoratorMetadata: true`, `module: commonjs`, `target: ES2022`, paths `@/*: ./src/*`
- `apps/server/src/bootstrap/main.ts`:
  - `NestFactory.create(AppModule)`, `enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: false })`, `app.setGlobalPrefix('')` (path 그대로 `/api/...` 사용), global ZodValidationPipe, global exception filter, listen `process.env.PORT ?? 4000`
- `apps/server/src/app.module.ts`: 빈 imports (다음 step에서 채움)
- `apps/server/src/common/`:
  - `api-response.util.ts`: `ok(data)`, `err(code, message)` helper
  - `exception-filter.ts`: `@Catch()` → 일관 envelope (단, 6개 기존 API는 envelope 미사용 raw payload 이므로 controller마다 raw 반환 + exception filter는 5xx/4xx만 envelope으로 감쌈)
  - `zod-validation.pipe.ts`: zod schema로 body 검증

> 6개 기존 API는 호환을 위해 raw payload를 반환 (기존 클라이언트 코드 변경 최소화). agent/내부 신규는 envelope 사용.

## 2. 완료 조건
- [ ] `pnpm --filter @seabw/server build` exit 0
- [ ] `pnpm --filter @seabw/server start` → "Nest application successfully started" 로그 + 포트 4000 listen
- [ ] `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/` → 404 (라우트 없음, 서버는 살아있음)
- [ ] cors origin이 환경변수 `WEB_ORIGIN` 으로 제어
- [ ] common/api-response.util.ts에 `ok()`, `err()` export
- [ ] ZodValidationPipe가 잘못된 body에 대해 400 반환

## 3. 롤백 방법
- `apps/server/src/{bootstrap,common,app.module.ts}` 삭제
- `apps/server/package.json` 의존성 되돌림

---

## Scope

### 신규 생성 파일
```
apps/server/nest-cli.json
apps/server/src/bootstrap/main.ts
apps/server/src/app.module.ts
apps/server/src/common/api-response.util.ts
apps/server/src/common/exception-filter.ts
apps/server/src/common/zod-validation.pipe.ts
apps/server/src/common/index.ts
```

### 수정 대상 파일
```
apps/server/package.json       # 의존성 채움
apps/server/tsconfig.json      # 데코레이터 메타 + paths
```

### 의존성 분석
| 모듈 | 영향 유형 | 설명 |
|------|----------|------|
| NestJS 11 | 신규 | server에 새 의존성 |
| reflect-metadata | 신규 | NestJS 필수 |
| @seabw/core | workspace 의존 | http/api-response 타입 import |

### Side Effect 위험
- NestJS 11 + Next.js 15는 React 18/19 충돌 가능 — server는 React 미사용 → 무관.
- SWC + TypeScript 데코레이터 메타데이터 → `nest-cli.json`의 `compilerOptions.builder: swc` + `typeCheck: true` 명시로 해결.

### 참고할 기존 패턴
- `/Users/mousebook/Documents/side-project/HypurrQuant_FE/apps/server/nest-cli.json`
- `/Users/mousebook/Documents/side-project/HypurrQuant_FE/apps/server/src/bootstrap/api/main-api.ts`

## FP/FN 검증

### FP
- `@nestjs/mongoose`, `@nestjs/schedule` 등 — 우리 phase 비범위. 제외 ✅.

### FN
- 글로벌 ValidationPipe 등록 — 명시함 ✅
- log 시스템 (pino) — 참조와 정합 하려면 좋지만 비범위. Nest 기본 Logger 사용. 명시함.

### 검증 통과: ✅

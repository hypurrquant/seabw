# Step 04: next.config build-time prod validation

## 메타데이터
- **난이도**: 🟡 / **롤백**: ✅

## 구현 내용
- `apps/web/next.config.ts` top-level 에 validation 블럭 추가:
  ```ts
  if (process.env.NEXT_PUBLIC_DEFIPILOT_ENV === 'prod') {
    const violations: string[] = [];
    if (process.env.DEFIPILOT_DEMO_BANNER !== 'false') violations.push('DEFIPILOT_DEMO_BANNER must be "false" in prod');
    if (process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID !== '999') violations.push('NEXT_PUBLIC_DEFAULT_CHAIN_ID must be "999" (HyperEVM) in prod');
    if (!process.env.HYPEREVM_RPC_URL) violations.push('HYPEREVM_RPC_URL is required in prod');
    if (violations.length) throw new Error(`[defipilot] prod env violations:\n - ${violations.join('\n - ')}`);
  }
  ```
- demo / dev env 는 영향 없음.

## 완료 조건
- [ ] `next.config.ts` 에 validation 블럭 (F15)
- [ ] prod env 위반 시 throw (수동 S4, F16)
- [ ] demo env 통과 (S2, F17)

## Scope
- 수정: `apps/web/next.config.ts`

## FP/FN 검증
- FP: 없음
- FN: HYPEREVM_RPC_URL 빈값 검증 추가 (R2 대응) — 포함됨
- 검증 통과: ✅

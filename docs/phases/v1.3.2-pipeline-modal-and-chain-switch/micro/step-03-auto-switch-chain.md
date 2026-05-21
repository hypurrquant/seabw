# Step 03: Execute 직전 자동 switchChain

## 메타데이터
- **난이도**: 🟢
- **선행 조건**: Step 02

## 구현 내용
- `execute-pipeline.ts` 진입부:
  ```ts
  import { getAccount, switchChain } from "@wagmi/core";
  import { getWagmiConfig } from "@/lib/wagmi";

  const config = getWagmiConfig();
  const account = getAccount(config);
  if (account.chainId !== 999) {
    await switchChain(config, { chainId: 999 });
  }
  ```
- switchChain throw 시 markFailed + rethrow → 모달 error phase 진입.
- 기존 `executePendingPipeline` signature 유지 (콜백 주입 없음).

## 완료 조건
- [ ] wallet 이 chain 999 아닌 상태에서 Execute → MetaMask 전환 프롬프트
- [ ] 전환 거부 시 모달 error phase 로 전이
- [ ] 전환 성공 후 정상 tx 진행 (`chain: undefined` viem 에러 사라짐)
- [ ] 기존 unit test (`execute-pipeline.test.ts`) 통과 (mock 만 추가)

## Scope
### 수정 대상
- `apps/web/src/domains/agent/runtime/execute-pipeline.ts` — switchChain 호출 추가
- `apps/web/src/domains/agent/runtime/__tests__/execute-pipeline.test.ts` — `@wagmi/core` mock 추가

# Step 13: HQ tool 핸들러 21개 + ServerProxyProvider 이식 + buildRegistryDeps

## 메타데이터
- **난이도**: 🟠
- **롤백 가능**: ✅
- **선행 조건**: Step 12

## 1. 구현 내용

### A. HQ → seabw 복사
HQ worktree `apps/web/src/domains/agent/tools/` 의 **모든 파일** 을 seabw `apps/web/src/domains/agent/tools/` 로 복사.

대상:
- `BrowserToolRegistry.ts`
- `index.ts`
- `compose-pipeline/handler.ts` (디렉토리)
- 21개 핸들러: get-pools, get-pool-detail, get-tick-data, get-token-prices, get-positions, get-swap-quote, get-token-balances, get-cached-balances, refresh-balances, get-wallet-status, calculate-token-ratio, calculate-deposit-amounts, calculate-optimal-range, calculate-swap-plan, calculate-tick-range, calculate-range-for-ratio, get-enriched-balances, get-native-balance, get-tokens.

복사 후 import 경로의 `@hq/*` 는 그대로 (workspace 가 해결), 로컬 `./` 도 그대로.

### B. ServerProxyProvider 이식
HQ worktree `apps/web/src/domains/agent/providers/ServerProxyProvider.ts` → seabw `apps/web/src/domains/agent/providers/ServerProxyProvider.ts`.

import 경로 수정:
- `import { AGENT_API_BASE } from '../config'` → seabw 의 origin 사용. `process.env.NEXT_PUBLIC_HQ_ORIGIN` 직접 또는 새로 `apps/web/src/domains/agent/config.ts` 작성:
```ts
export const AGENT_API_BASE = `${process.env.NEXT_PUBLIC_HQ_ORIGIN}/api/v1`;
```

### C. `buildRegistryDeps` 신규
`apps/web/src/domains/agent/runtime/registry-deps.ts`:
```ts
import { createPublicClient, http } from "viem";
import { getAccount } from "wagmi/actions";
import { wagmiConfig } from "@/lib/wagmi";
import { SUPPORTED_CHAINS } from "@/lib/wagmi";    // 기존 — wagmi config 의 chains 사용
import type { RegistryDeps } from "../tools";

const SUPPORTED_CHAIN_MAP = Object.fromEntries(SUPPORTED_CHAINS.map((c) => [c.id, c]));

function createEphemeralBalanceStore(): RegistryDeps["balanceStore"] {
  const cache: Record<string, Record<string, Record<string, bigint>>> = {};
  return {
    getState: () => ({
      cache,
      refresh: async () => undefined,
      getBalance: () => 0n,
    }),
  };
}

export function buildRegistryDeps(getAuthToken: () => string): RegistryDeps {
  const clients = new Map<number, ReturnType<typeof createPublicClient>>();
  return {
    getPublicClient(chainId) {
      if (!clients.has(chainId)) {
        const chain = SUPPORTED_CHAIN_MAP[chainId];
        if (!chain) throw new Error(`chain ${chainId} not in SUPPORTED_CHAINS`);
        clients.set(chainId, createPublicClient({ chain, transport: http() }));
      }
      return clients.get(chainId)!;
    },
    getActiveAccount() {
      const account = getAccount(wagmiConfig);
      return {
        activeAddress: account.address ?? null,
        executionMode: "eoa",
        ready: account.status === "connected",
      };
    },
    balanceStore: createEphemeralBalanceStore(),
    getRelaySignDeps: () => null,
    getAuthToken,
  };
}
```

### D. typecheck 패스
- 21개 핸들러 안에 `@hq/core/defi/routing` 등 transitive import 가 있다면 자동 resolve. typecheck 실패 시 missing import 1건씩 fix.

## 2. 완료 조건
- [ ] 21개 핸들러 + `BrowserToolRegistry.ts` + `index.ts` + `compose-pipeline/` 모두 seabw 에 존재
- [ ] `ServerProxyProvider.ts` 존재
- [ ] `buildRegistryDeps` 5필드 모두 wiring
- [ ] `apps/web/src/domains/agent/config.ts` (AGENT_API_BASE) 존재
- [ ] `pnpm typecheck` 통과

## Scope
### 수정 파일
- 없음 (신규 파일 추가만)

### 신규 파일
- `apps/web/src/domains/agent/tools/*` (HQ 복사)
- `apps/web/src/domains/agent/providers/ServerProxyProvider.ts`
- `apps/web/src/domains/agent/runtime/registry-deps.ts`
- `apps/web/src/domains/agent/config.ts`

### Side Effect 위험
- HQ 핸들러가 `@hq/react/balance` 같은 다른 store 의존 시 build 깨질 수 있음 → P1 tool 은 등록만 되고 호출 시 throw 가능. P0 path (get_wallet_status / get_pools / get_token_prices / compose_pipeline) 는 반드시 동작.

## FP/FN
### FP
- HQ tool 21개 전부 복사 — P1 항목이 미사용이면 일부는 dead code. 의도된 결과.

### FN
- HQ tool 의 deps 가 P0 path 외 다른 store 를 요구하면 import error → tsc 에서 잡힘.

검증 통과: ✅

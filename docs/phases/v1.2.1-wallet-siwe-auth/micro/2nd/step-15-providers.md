# Step 15: HqBootProvider + AgentRuntimeProvider + Provider 트리 wiring + .env.local

## 메타데이터
- **난이도**: 🟠
- **롤백 가능**: ✅
- **선행 조건**: Step 12, 13, 14

## 1. 구현 내용

### A. `apps/web/src/domains/agent/providers/HqBootProvider.tsx`
- design.md §5-1 그대로.
- mount 시 1회 `setHttpBaseUrl(NEXT_PUBLIC_HQ_ORIGIN)` + `initPlatformDeps({ execute, signMessage, storage, showToast, onBeforeUnload, getSignDeps })`.
- `execute` 반환은 `{ hash }`.
- React 19 StrictMode 의 dev double-mount **반드시 회피**: **module-level singleton flag** 사용. `useRef` 는 StrictMode 의 두 번째 mount 에서 새 ref 가 만들어져 무효.
  ```ts
  // 모듈 스코프
  let __hqPlatformInitialized = false;
  // 컴포넌트 내부
  useEffect(() => {
    if (__hqPlatformInitialized) return;
    __hqPlatformInitialized = true;
    setHttpBaseUrl(...);
    initPlatformDeps({...});
  }, []);
  ```

### B. `apps/web/src/domains/agent/providers/AgentRuntimeProvider.tsx`
- design.md §5-2 그대로.
- `tokenRef = useRef("")`, `tokenRef.current = state.auth.token ?? ""`.
- `useMemo(() => createBrowserToolRegistry(buildRegistryDeps(() => tokenRef.current)), [])`.
- StrictMode dev double-mount 회피: **module-level singleton flag**.
  ```ts
  let __hqAgentInitialized = false;
  useEffect(() => {
    if (__hqAgentInitialized) return;
    __hqAgentInitialized = true;
    registry.register("propose_lp_positions", createProposeLpPositionsHandler({
      pushProposal: (p) => useLpProposalStore.getState().push(p),
    }));
    initAgentDeps({ provider, toolRegistry: registry, chatHistory, apiBase });
  }, []);
  ```
- `useEffect(() => useAgentStore.setState({ auth: {...} }), [token, expiresAt])`.

### C. `apps/web/src/components/providers.tsx` 갱신
- 트리: WagmiProvider → QueryClientProvider → AppStateProvider → HqClientProvider → HqBootProvider → AgentRuntimeProvider → WalletModalProvider → children + ConnectWalletModal.

### D. `apps/web/.env.local.example` 갱신
```
NEXT_PUBLIC_HQ_ORIGIN=http://localhost:3003
NEXT_PUBLIC_HQ_BASE_URL=http://localhost:3003/api/v1
```

### E. `apps/web/src/domains/agent/runtime/in-memory-chat-history.ts`
- `ChatHistoryPort` 구현. demo 한정 in-memory.

### F. typecheck
- initPlatformDeps / initAgentDeps 의 정확한 시그니처는 `@hq/react/{platform,agent}` 의 `.d.ts` 로 확인.
- 누락 필드 발견 시 fix (design.md §5-1, §5-2 의 `⚠️` 항목).

## 2. 완료 조건
- [ ] HqBootProvider, AgentRuntimeProvider 신규
- [ ] providers.tsx 트리 갱신
- [ ] .env.local.example 갱신 (NEXT_PUBLIC_HQ_ORIGIN)
- [ ] 사용자에게 `.env.local` 추가 안내 (수동)
- [ ] InMemoryChatHistoryAdapter 신규
- [ ] `pnpm typecheck` 통과
- [ ] `pnpm build` 통과 (Static prerender — useAccount 등 mount 가드 처리 필요)

## Scope
### 수정 파일
- `apps/web/src/components/providers.tsx`
- `apps/web/.env.local.example`

### 신규 파일
- `apps/web/src/domains/agent/providers/HqBootProvider.tsx`
- `apps/web/src/domains/agent/providers/AgentRuntimeProvider.tsx`
- `apps/web/src/domains/agent/runtime/in-memory-chat-history.ts`

### Side Effect 위험
- StrictMode double-mount 로 init throw → flag 패턴으로 회피.
- Static prerender 시 wagmi/agent hook 진입 → 1차 SIWE 의 WalletBadge 처리 패턴 재사용 (mounted gate).

## FP/FN
### FP
- 없음.

### FN
- `initAgentDeps` 의 실제 필수 필드가 design.md 와 다르면 typecheck 에서 잡힘. 누락 시 fix.

검증 통과: ✅

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createComposePipelineHandler } from '../handler';

const mocks = vi.hoisted(() => ({
  previewRecipe: vi.fn(),
  addPendingResolved: vi.fn(),
}));

vi.mock('@/infra/platform/webPlatformDeps', () => ({
  webPlatformDeps: {
    previewRecipe: mocks.previewRecipe,
  },
}));

vi.mock('@hq/react/agent', () => ({
  usePipelineStore: {
    getState: () => ({
      addPendingResolved: mocks.addPendingResolved,
    }),
  },
}));

describe('createComposePipelineHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.previewRecipe.mockResolvedValue({
      resolved: {
        stages: [],
        shared: {},
        summary: [{ stageId: 'mint', label: 'Mint' }],
      },
      summary: [{ stageId: 'mint', label: 'Mint' }],
      previewedTick: 456,
    });
  });

  it('uses previewRecipe and stores previewedTick in pending pipeline entry', async () => {
    const handler = createComposePipelineHandler({
      getPublicClient: () => ({}) as never,
      getActiveAccount: () => ({
        activeAddress: '0x00000000000000000000000000000000000000aa',
        executionMode: 'eoa',
        ready: true,
      }),
      balanceStore: {
        getState: () => ({
          cache: {},
          refresh: async () => undefined,
          getBalance: () => 0n,
        }),
      },
      getRelaySignDeps: () => null,
      getAuthToken: () => 'token',
    });

    const result = await handler(
      {
        stages: [
          {
            atom: 'mint',
            params: {
              dex: 'kittenswap',
              chainId: 999,
              poolAddress: '0x1111111111111111111111111111111111111111',
              tickLower: -100,
              tickUpper: 100,
              token0Amount: 1n,
              token1Amount: 2n,
              slippageBps: 200,
              deadline: 1200,
              amountPolicy: { kind: 'cap-to-input' },
            },
          },
        ],
      },
      { sessionId: 's1' },
    );

    expect(mocks.previewRecipe).toHaveBeenCalledTimes(1);
    const previewCall = mocks.previewRecipe.mock.calls[0];
    expect(previewCall).toBeDefined();
    if (!previewCall) throw new Error('previewRecipe should have been called');

    const [recipe, ownerAddress] = previewCall;
    expect(Array.isArray(recipe)).toBe(true);
    expect(ownerAddress).toBe('0x00000000000000000000000000000000000000aa');
    expect(mocks.addPendingResolved).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({
        previewedTick: 456,
      }),
      expect.objectContaining({
        summary: [{ stageId: 'mint', label: 'Mint' }],
      }),
    );
    if (result.status !== 'prepared_pipeline') {
      throw new Error(`Expected prepared_pipeline result, got ${result.status}`);
    }
    expect(typeof result.pipelineId).toBe('string');
    expect(result.pipelineId.length).toBeGreaterThan(0);
    expect(result.summary).toEqual([{ stageId: 'mint', label: 'Mint' }]);
  });
});

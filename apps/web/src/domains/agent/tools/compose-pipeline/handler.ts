/**
 * compose_pipeline handler (v1.57.1)
 *
 * v1.57.1: FE resolver 삭제 → 서버 /pipeline/resolve API 호출.
 * RecipeAtom[] → 서버 resolve → ResolvedPipeline → usePipelineStore 등록.
 */
import { RECIPE_ATOM_NAMES } from '@hq/core/defi/pipeline/types';
import type { RecipeAtom, RecipeAtomName } from '@hq/core/defi/pipeline/types';
import type { ToolResult } from '@hq/react/agent';
import type { BrowserToolHandler, ToolContext } from '../BrowserToolRegistry';
import type { RegistryDeps } from '../index';
import { usePipelineStore } from '@hq/react/agent';
import { previewRecipe } from '@hq/react/defi/pipeline';

function isRecipeAtomName(v: string): v is RecipeAtomName {
  return RECIPE_ATOM_NAMES.findIndex((n) => n === v) !== -1;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toStageRecipe(s: Record<string, unknown>): RecipeAtom | null {
  const params: Record<string, unknown> = isPlainObject(s['params']) ? s['params'] : {};
  if (typeof s['atom'] === 'string' && isRecipeAtomName(s['atom'])) {
    return { atom: s['atom'], params } as RecipeAtom; // @ci-exception(type-assertion-count) — isRecipeAtomName guard validates atom, TS can't narrow into RecipeAtom DU
  }
  return null;
}

let pipelineCounter = 0;

function generatePipelineId(): string {
  return `pipeline-${Date.now()}-${++pipelineCounter}`;
}

// ── Handler Factory ──

export function createComposePipelineHandler(deps: RegistryDeps): BrowserToolHandler {
  return async (args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    if (!context.sessionId) {
      return { status: 'error', code: 'SESSION_REQUIRED', message: 'Session is required for pipeline registration' };
    }

    const rawStages = args['stages'];
    if (!Array.isArray(rawStages) || rawStages.length === 0) {
      return { status: 'error', code: 'INVALID_RECIPE', message: 'stages array is required and must not be empty' };
    }

    // 각 stage의 params 존재 + atom 검증 + RecipeAtom 변환
    const stages: RecipeAtom[] = [];
    for (let i = 0; i < rawStages.length; i++) {
      const raw = rawStages[i];
      if (!isPlainObject(raw)) {
        return { status: 'error', code: 'INVALID_RECIPE', message: `Stage ${i}: must be an object` };
      }
      const allowedKeys = new Set(['atom', 'params']);
      const unknownKeys = Object.keys(raw).filter((k) => !allowedKeys.has(k));
      if (unknownKeys.length > 0) {
        return { status: 'error', code: 'INVALID_RECIPE', message: `Stage ${i}: unknown keys: ${unknownKeys.join(', ')}. Only atom, params are allowed.` };
      }
      if (typeof raw['atom'] !== 'string' || raw['atom'].length === 0) {
        return { status: 'error', code: 'INVALID_RECIPE', message: `Stage ${i}: atom is required` };
      }
      const recipe = toStageRecipe(raw);
      if (recipe === null) {
        return { status: 'error', code: 'INVALID_RECIPE', message: `Stage ${i}: atom value is not recognized` };
      }
      stages.push(recipe);
    }

    // v1.57.1: 서버에 resolve 요청 — FE에서 atoms/handler를 import하지 않음
    try {
      const account = deps.getActiveAccount();
      if (!account.activeAddress) {
        return { status: 'error', code: 'NO_WALLET', message: 'Wallet not connected' };
      }
      const preview = await previewRecipe(stages, account.activeAddress, null);

      const pipelineId = generatePipelineId();
      const base = {
        pipelineId,
        recipe: stages,
        summary: preview.summary,
        createdAt: Date.now(),
        previewedTick: preview.previewedTick,
      };

      // ResolvedPipeline으로 store에 등록 (JSON 직렬화 가능, persist 가능)
      usePipelineStore.getState().addPendingResolved(context.sessionId, base, preview.resolved);

      return {
        status: 'prepared_pipeline',
        pipelineId,
        summary: preview.summary,
      };
    } catch (e) { // @ci-exception(no-empty-catch) /* resolve boundary returns ToolResult error envelope */
      const message = e instanceof Error ? e.message : String(e);
      return { status: 'error', code: 'RESOLVE_FAILED', message };
    }
  };
}

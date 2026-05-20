import type { PipelinePlan } from "@seabw/core";

interface Entry {
  plan: PipelinePlan;
  address: string;
  storedAt: number;
}

const STORE = new Map<string, Entry>();
const TTL_MS = 10 * 60_000; // plans expire 10 min after creation

function sweep(): void {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, e] of STORE) {
    if (e.storedAt < cutoff) STORE.delete(id);
  }
}

export function rememberPlan(plan: PipelinePlan, address: string): void {
  sweep();
  STORE.set(plan.planId, { plan, address: address.toLowerCase(), storedAt: Date.now() });
}

export function recallPlan(planId: string): Entry | undefined {
  sweep();
  return STORE.get(planId);
}

export function forgetPlan(planId: string): void {
  STORE.delete(planId);
}

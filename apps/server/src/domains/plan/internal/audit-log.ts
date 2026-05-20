import { createHash } from "node:crypto";

export interface PlanAuditEntry {
  ts: string;
  anonId: string;
  tier: string;
  intentLen: number;
  appliedRules: string[];
  rejectedRuleId?: string;
  durationMs: number;
  ok: boolean;
}

export function anonId(ip: string, address: string): string {
  const h = createHash("sha256")
    .update(`${ip}::${address.toLowerCase()}::${process.env.AUDIT_SALT ?? "defipilot"}`)
    .digest("hex");
  return h.slice(0, 12);
}

export function logPlanRequest(entry: PlanAuditEntry): void {
  // Hackathon-scope: console structured log. In prod, ship to a real sink.
  // eslint-disable-next-line no-console
  console.log(`[audit] ${JSON.stringify(entry)}`);
}

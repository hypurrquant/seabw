"use client";

import { Handle, NodeProps, Position } from "@xyflow/react";
import { Pill } from "@/components/ui";
import type { PlanStep } from "@/types";
import { chainName } from "@/config/chains";
import { formatPct, formatUsd } from "@/lib/utils";

const ACTION_LABEL: Record<PlanStep["kind"], string> = {
  swap: "Swap",
  bridge: "Bridge",
  "lend.supply": "Supply",
  "lend.withdraw": "Withdraw",
  "lp.add": "Add LP",
  "lp.remove": "Remove LP",
  "lp.stake": "Stake LP",
  "lp.claim": "Claim",
};

const RISK_TONE: Record<string, "warn" | "danger" | "ok"> = {
  IL: "warn",
  leverage: "danger",
  "fresh-pool": "danger",
  "non-audited": "danger",
  bridge: "warn",
};

export type PlanNodeData = {
  step: PlanStep;
  index: number;
  total: number;
  active?: boolean;
  status?: "pending" | "signed" | "broadcasted" | "confirmed" | "failed" | "skipped";
} & Record<string, unknown>;

export function PlanNode({ data }: NodeProps) {
  const { step, index, total, active, status } = data as unknown as PlanNodeData;
  const isLast = index === total - 1;
  return (
    <div
      className={
        "min-w-[260px] max-w-[300px] rounded-[var(--radius-card)] border p-3 transition-colors " +
        (active
          ? "border-[color:var(--color-accent)] bg-[color:var(--color-panel-2)] shadow-[0_0_0_3px_rgba(79,124,255,0.18)]"
          : status === "confirmed"
            ? "border-[color:var(--color-success)]/60 bg-[color:var(--color-panel-2)]"
            : status === "failed"
              ? "border-[color:var(--color-danger)]/60 bg-[color:var(--color-panel-2)]"
              : "border-[color:var(--color-border)] bg-[color:var(--color-panel-2)]")
      }
    >
      {index > 0 && <Handle type="target" position={Position.Top} className="!h-2 !w-2" />}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[color:var(--color-fg-muted)]">
          <span>#{index + 1}</span>
          <span>{ACTION_LABEL[step.kind]}</span>
        </div>
        <Pill>{chainName(step.chainId)}</Pill>
      </div>
      <div className="mt-1 text-sm font-medium">{step.protocol}</div>
      <div className="mt-2 grid grid-cols-1 gap-1 text-xs">
        <Row label="In" value={step.expected.inputs.map((t) => `${t.amount} ${t.token}`).join(" + ") || "—"} />
        <Row label="Out" value={step.expected.outputs.map((t) => `${t.amount} ${t.token}`).join(" + ") || "—"} />
        <Row label="Slippage" value={`${step.expected.slippagePct.toFixed(2)}%`} />
        {typeof step.expected.aprPct === "number" && step.expected.aprPct > 0 && (
          <Row label="APR" value={formatPct(step.expected.aprPct, 1)} />
        )}
        <Row label="Fee" value={formatUsd(step.expected.feeUsd)} />
      </div>
      {step.risks.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {step.risks.map((r) => (
            <Pill key={r} tone={RISK_TONE[r] ?? "warn"}>
              {r}
            </Pill>
          ))}
        </div>
      )}
      {status && status !== "pending" && (
        <div className="mt-2 text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)]">
          {status}
        </div>
      )}
      {!isLast && <Handle type="source" position={Position.Bottom} className="!h-2 !w-2" />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[color:var(--color-fg-muted)]">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  );
}

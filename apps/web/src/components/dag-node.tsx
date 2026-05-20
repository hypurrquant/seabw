"use client";

import { Handle, NodeProps, Position } from "@xyflow/react";
import {
  ArrowLeftRight,
  Cable,
  Droplets,
  Gift,
  Landmark,
  Layers,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { Pill } from "@/components/ui";
import type { PlanStep } from "@seabw/core";
import { chainName } from "@seabw/core";
import { cn, formatPct, formatUsd } from "@/lib/utils";

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

const ACTION_ICON: Record<PlanStep["kind"], LucideIcon> = {
  swap: ArrowLeftRight,
  bridge: Cable,
  "lend.supply": Landmark,
  "lend.withdraw": Landmark,
  "lp.add": Droplets,
  "lp.remove": Droplets,
  "lp.stake": Sprout,
  "lp.claim": Gift,
};

// Warm-theme accent per action family — keeps the DAG legible at a glance.
const ACTION_ACCENT: Record<PlanStep["kind"], string> = {
  swap: "text-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10",
  bridge: "text-[color:var(--color-accent-2)] bg-[color:var(--color-accent-2)]/10",
  "lend.supply": "text-[color:var(--color-success)] bg-[color:var(--color-success)]/10",
  "lend.withdraw": "text-[color:var(--color-success)] bg-[color:var(--color-success)]/10",
  "lp.add": "text-[color:var(--color-balanced)] bg-[color:var(--color-balanced)]/10",
  "lp.remove": "text-[color:var(--color-balanced)] bg-[color:var(--color-balanced)]/10",
  "lp.stake": "text-[color:var(--color-aggressive)] bg-[color:var(--color-aggressive)]/10",
  "lp.claim": "text-[color:var(--color-aggressive)] bg-[color:var(--color-aggressive)]/10",
};

const RISK_TONE: Record<string, "warn" | "danger" | "ok"> = {
  IL: "warn",
  leverage: "danger",
  "fresh-pool": "danger",
  "non-audited": "danger",
  bridge: "warn",
};

const STATUS_DOT: Record<string, string> = {
  confirmed: "bg-[color:var(--color-success)]",
  broadcasted: "bg-[color:var(--color-accent)]",
  signed: "bg-[color:var(--color-accent)]",
  failed: "bg-[color:var(--color-danger)]",
  skipped: "bg-[color:var(--color-fg-muted)]",
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
  const Icon = ACTION_ICON[step.kind];
  return (
    <div
      className={cn(
        "w-[280px] rounded-[var(--radius-card)] border bg-[color:var(--color-panel)] p-3.5 shadow-[0_1px_2px_rgba(45,42,38,0.05),0_10px_28px_-18px_rgba(45,42,38,0.18)] transition-all",
        active
          ? "border-[color:var(--color-accent)] shadow-[0_0_0_3px_rgba(204,120,92,0.2)]"
          : status === "confirmed"
            ? "border-[color:var(--color-success)]/60"
            : status === "failed"
              ? "border-[color:var(--color-danger)]/60"
              : "border-[color:var(--color-border)]",
      )}
    >
      {index > 0 && <Handle type="target" position={Position.Top} className="!h-2 !w-2" />}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("flex h-7 w-7 flex-none items-center justify-center rounded-md", ACTION_ACCENT[step.kind])}>
            <Icon size={15} strokeWidth={2} />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)]">
              Step {index + 1} · {ACTION_LABEL[step.kind]}
            </span>
            <span className="text-sm font-semibold tracking-tight">{step.protocol}</span>
          </div>
        </div>
        <Pill>{chainName(step.chainId)}</Pill>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1 text-xs">
        <Row label="In" value={step.expected.inputs.map((t) => `${t.amount} ${t.token}`).join(" + ") || "—"} mono />
        <Row label="Out" value={step.expected.outputs.map((t) => `${t.amount} ${t.token}`).join(" + ") || "—"} mono />
        <Row label="Slippage" value={`${step.expected.slippagePct.toFixed(2)}%`} mono />
        {typeof step.expected.aprPct === "number" && step.expected.aprPct > 0 && (
          <Row label="APR" value={formatPct(step.expected.aprPct, 1)} mono accent />
        )}
        <Row label="Fee" value={formatUsd(step.expected.feeUsd)} mono />
      </div>

      {step.risks.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {step.risks.map((r) => (
            <Pill key={r} tone={RISK_TONE[r] ?? "warn"}>
              {r}
            </Pill>
          ))}
        </div>
      )}

      {status && status !== "pending" && (
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-[color:var(--color-border)] pt-2 text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)]">
          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status] ?? "bg-[color:var(--color-fg-muted)]")} />
          {status}
        </div>
      )}

      {!isLast && <Handle type="source" position={Position.Bottom} className="!h-2 !w-2" />}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[color:var(--color-fg-muted)]">{label}</span>
      <span
        className={cn(
          "truncate text-right",
          mono && "font-mono tabular-nums",
          accent && "font-medium text-[color:var(--color-accent)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

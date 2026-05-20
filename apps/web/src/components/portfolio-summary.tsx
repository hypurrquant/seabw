"use client";

import { Button, Card, Pill } from "@/components/ui";
import { useApp } from "@/state/app-state";
import { CHAINS, chainName } from "@seabw/core";
import { formatPct, formatUsd, shortHash } from "@/lib/utils";

export function PortfolioSummary() {
  const { state, dispatch } = useApp();
  const plan = state.plan;
  const exec = state.execution;
  if (!plan) return null;

  const failed = exec?.perStep.filter((p) => p.status === "failed") ?? [];
  const skipped = exec?.perStep.filter((p) => p.status === "skipped") ?? [];
  const partial = failed.length > 0 || skipped.length > 0;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-3xl flex-col px-6 py-12">
      <Pill>All done</Pill>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Position deployed</h1>
      <p className="mt-2 text-sm text-[color:var(--color-fg-muted)]">
        Your plan ran end-to-end. Track your positions below. APR is estimated, not guaranteed.
      </p>

      <Card className="mt-6" title="Plan summary">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Metric label="Est. APR" value={formatPct(plan.aggregate.estimatedAprPct, 1)} />
          <Metric label="Gas spent (est.)" value={formatUsd(plan.aggregate.estimatedGasUsd)} />
          <Metric label="Steps" value={`${plan.steps.length}`} />
          <Metric label="Tier" value={plan.tier} />
        </div>
      </Card>

      <Card className="mt-4" title="Steps">
        <ul className="flex flex-col gap-2">
          {plan.steps.map((s) => {
            const r = exec?.perStep.find((p) => p.stepId === s.id);
            const tx = r?.txHash;
            const explorer = tx ? CHAINS[s.chainId]?.explorerTxUrl(tx) : null;
            return (
              <li key={s.id} className="panel-2 flex items-center justify-between gap-2 px-3 py-2 text-xs">
                <div>
                  <div className="font-medium text-sm">{s.kind} · {s.protocol}</div>
                  <div className="text-[color:var(--color-fg-muted)]">{chainName(s.chainId)}</div>
                </div>
                <div className="text-right">
                  <Pill tone={r?.status === "confirmed" ? "ok" : r?.status === "failed" ? "danger" : "default"}>
                    {r?.status ?? "pending"}
                  </Pill>
                  {explorer && (
                    <div className="mt-1">
                      <a className="underline text-[color:var(--color-fg-muted)]" href={explorer} target="_blank" rel="noreferrer">
                        {shortHash(tx)}
                      </a>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {partial && (
        <Card
          className="mt-4 border-[color:var(--color-warning)]/40"
          title="Partial execution — recovery plan"
          description="DefiPilot never auto-reverses on-chain state. Choose how to proceed:"
        >
          <ul className="flex flex-col gap-1 text-xs text-[color:var(--color-fg-muted)]">
            {failed.length > 0 && (
              <li>
                {failed.length} step(s) failed on-chain. You can rebuild a fresh plan
                that starts from current balances — DefiPilot will detect what already
                moved.
              </li>
            )}
            {skipped.length > 0 && (
              <li>
                {skipped.length} step(s) were skipped before broadcast. The next plan
                will re-derive intent from current holdings rather than the original
                deposit.
              </li>
            )}
            <li>
              If you want to unwind, open the LP / supply step on the protocol page
              directly — DefiPilot only sells positions you explicitly approve.
            </li>
          </ul>
        </Card>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => dispatch({ type: "RESET" })}>
          Start over
        </Button>
        <Button
          onClick={() =>
            dispatch({
              type: "GOTO",
              stage: state.mode === "marketplace" ? "marketplace" : "intent",
            })
          }
        >
          {partial ? "Build recovery plan" : "Build another plan"}
        </Button>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)]">
        {label}
      </span>
      <span className="text-base">{value}</span>
    </div>
  );
}

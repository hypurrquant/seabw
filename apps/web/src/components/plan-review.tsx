"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Check, Loader2 } from "lucide-react";
import { Button, Card, Pill } from "@/components/ui";
import { useApp } from "@/state/app-state";
import { formatPct, formatUsd, truncateAddress } from "@/lib/utils";
import { humanizeGuardrail } from "@/lib/guardrail-labels";
import { PlanNode, type PlanNodeData } from "@/components/dag-node";
import { SignFlow } from "@/components/sign-flow";
import type { PipelinePlan } from "@seabw/core";
import { http } from "@/lib/http";

const nodeTypes = { plan: PlanNode };

export function PlanReview() {
  const { state, dispatch } = useApp();
  const plan = state.plan;
  const { address, status: walletStatus } = useAccount();
  const { connectors, connect, isPending: connecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const [signing, setSigning] = useState(false);
  const [awaitingWallet, setAwaitingWallet] = useState(false);
  const [rehydrating, setRehydrating] = useState(false);
  const [rehydrateError, setRehydrateError] = useState<string | null>(null);

  // Plan-build defaults to the burn placeholder when no wallet is connected
  // so users can preview. We always call /api/plan/rehydrate before sign —
  // the server fast-paths when the bound address already matches the signer
  // (no extra defi-cli round-trip), so this is safe for both paths and also
  // resets the precheck freshness window for users who lingered on the page.

  const graph = useMemo(() => {
    if (!plan) return { nodes: [], edges: [] };
    const nodes: Node<PlanNodeData>[] = plan.steps.map((s, i) => ({
      id: s.id,
      type: "plan",
      position: { x: 60, y: i * 220 },
      data: { step: s, index: i, total: plan.steps.length, status: "pending" },
    }));
    const edges: Edge[] = plan.steps.slice(1).map((s, i) => ({
      id: `${plan.steps[i].id}-${s.id}`,
      source: plan.steps[i].id,
      target: s.id,
      animated: true,
    }));
    return { nodes, edges };
  }, [plan]);

  const rehydrateAndSign = async (signerAddress: string) => {
    if (!plan) return;
    setRehydrating(true);
    setRehydrateError(null);
    try {
      const data = await http<{ plan: PipelinePlan }>({
        url: "/api/plan/rehydrate",
        method: "POST",
        body: { planId: plan.planId, signerAddress },
      });
      if (!data.plan) {
        setRehydrateError("Server returned empty plan.");
        return;
      }
      dispatch({ type: "SET_PLAN", plan: data.plan });
      setSigning(true);
    } catch (err) {
      setRehydrateError((err as Error).message);
    } finally {
      setRehydrating(false);
    }
  };

  // Auto-progress once the user finishes the WalletConnect / injected flow we
  // surfaced when they hit "Approve & sign". This is the bridge from "previewed
  // with burn placeholder" to "signing with real recipient".
  useEffect(() => {
    if (!awaitingWallet || walletStatus !== "connected" || !address) return;
    setAwaitingWallet(false);
    void rehydrateAndSign(address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingWallet, walletStatus, address]);

  // Esc dismisses the connect-modal so a user who changed their mind can back
  // out without hunting for the Cancel button.
  useEffect(() => {
    if (!awaitingWallet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAwaitingWallet(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [awaitingWallet]);

  if (!plan) return null;

  const onApproveAndSign = () => {
    if (!address) {
      setAwaitingWallet(true);
      return;
    }
    void rehydrateAndSign(address);
  };

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-6xl flex-col px-6 py-8">
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Pill>Plan Review</Pill>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your plan</h1>
          <p className="text-sm text-[color:var(--color-fg-muted)]">
            Every step ran as a defi-cli dry-run. Calldata is rebound to your wallet on Approve &amp; sign and re-checked within 5 min of each signature.
          </p>
          {!address && (
            <p className="mt-2 max-w-2xl text-xs text-[color:var(--color-fg-muted)]">
              Preview mode — calldata is bound to a burn placeholder so you can review APR + gas
              without connecting a wallet. Hit Approve &amp; sign to connect and rebind every
              step&apos;s recipient to your address.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            onClick={() =>
              dispatch({
                type: "GOTO",
                stage: state.mode === "marketplace" ? "basket-review" : "intent",
              })
            }
          >
            {state.mode === "marketplace" ? "Edit basket" : "Edit intent"}
          </Button>
          <Button variant="secondary" onClick={() => dispatch({ type: "RESET" })}>
            Abort
          </Button>
          <Button onClick={onApproveAndSign} disabled={rehydrating}>
            {rehydrating
              ? "Rehydrating with your address…"
              : address
                ? "Approve & sign"
                : "Connect wallet & sign"}
          </Button>
        </div>
      </header>

      {rehydrateError && (
        <div className="panel-2 border-[color:var(--color-danger)]/40 text-sm text-[color:var(--color-danger)] p-3 mb-3">
          {rehydrateError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="relative h-[420px] overflow-hidden panel md:h-[640px]">
          <ReactFlowProvider>
            <ReactFlow
              nodes={graph.nodes}
              edges={graph.edges}
              nodeTypes={nodeTypes}
              fitView
              proOptions={{ hideAttribution: false }}
              panOnScroll
              zoomOnScroll={false}
              minZoom={0.4}
              maxZoom={1.6}
            >
              <Background gap={24} color="rgba(204,120,92,0.14)" />
              <Controls position="bottom-right" />
            </ReactFlow>
          </ReactFlowProvider>
          {rehydrating && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[color:var(--color-bg)]/70 backdrop-blur-sm">
              <Loader2 size={28} strokeWidth={2} className="animate-spin text-[color:var(--color-accent)]" />
              <div className="text-sm font-medium">Rebinding calldata to your wallet…</div>
              <div className="max-w-xs text-center text-xs text-[color:var(--color-fg-muted)]">
                Re-running defi-cli with your address so every recipient is yours, then a fresh precheck.
              </div>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card title="Aggregate" description="Estimated, not guaranteed.">
            <Metric label="Est. APR" value={formatPct(plan.aggregate.estimatedAprPct, 1)} />
            <Metric label="Est. gas" value={formatUsd(plan.aggregate.estimatedGasUsd)} />
            <Metric label="Steps" value={`${plan.steps.length}`} />
            {plan.aggregate.riskFlags.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-[color:var(--color-fg-muted)]">
                  Risk flags
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {plan.aggregate.riskFlags.map((r) => (
                    <Pill key={r} tone="warn">{r}</Pill>
                  ))}
                </div>
              </div>
            )}
          </Card>
          <Card title="Applied guardrails" description="Every rule the policy engine enforced on this plan. Hover for what each one means.">
            <ul className="grid grid-cols-1 gap-1.5 text-xs">
              {plan.guardrails.appliedRules.map((r) => {
                const g = humanizeGuardrail(r);
                return (
                  <li
                    key={r}
                    title={g.detail}
                    className="group flex cursor-help items-center justify-between gap-2 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-panel-2)] px-2.5 py-1.5"
                  >
                    <span className="flex items-center gap-1.5">
                      <Check size={12} strokeWidth={2.5} className="flex-none text-[color:var(--color-success)]" />
                      <span className="text-[color:var(--color-fg)]">{g.label}</span>
                    </span>
                    {g.value && (
                      <span className="flex-none font-mono text-[10px] text-[color:var(--color-fg-muted)]">
                        {g.value}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
          {address && (
            <Card title="Signer" description="Will be used as recipient on rehydrate.">
              <div className="flex items-center justify-between text-xs">
                <span>{truncateAddress(address)}</span>
                <Button variant="ghost" size="sm" onClick={() => disconnect()}>
                  Disconnect
                </Button>
              </div>
            </Card>
          )}
        </aside>
      </div>

      {awaitingWallet && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[color:var(--color-fg)]/20 backdrop-blur-sm p-6">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between">
              <Pill>Connect to sign</Pill>
              <Button variant="ghost" size="sm" onClick={() => setAwaitingWallet(false)}>
                Cancel
              </Button>
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Pick a wallet</h2>
            <p className="text-xs text-[color:var(--color-fg-muted)]">
              We rebuild calldata against your address before any signature. WalletConnect shows
              a QR for mobile wallets.
            </p>
            <div className="grid w-full grid-cols-1 gap-2">
              {connectors.map((c) => (
                <Button
                  key={c.uid}
                  variant="secondary"
                  disabled={connecting}
                  onClick={() => connect({ connector: c })}
                  className="justify-between"
                >
                  <span>{c.name}</span>
                  <span className="text-[10px] text-[color:var(--color-fg-muted)]">{c.type}</span>
                </Button>
              ))}
            </div>
            {connectError && (
              <div className="panel-2 border-[color:var(--color-danger)]/40 text-xs text-[color:var(--color-danger)] p-2">
                {connectError.message}
              </div>
            )}
            <p className="text-[10px] text-[color:var(--color-fg-muted)]">
              By connecting, you confirm DefiPilot does not custody your assets.
            </p>
          </Card>
        </div>
      )}

      {signing && (
        <SignFlow
          plan={plan}
          onClose={() => setSigning(false)}
          onComplete={() => {
            setSigning(false);
            dispatch({ type: "GOTO", stage: "portfolio" });
          }}
        />
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs uppercase tracking-wider text-[color:var(--color-fg-muted)]">
        {label}
      </span>
      <span className="text-base">{value}</span>
    </div>
  );
}

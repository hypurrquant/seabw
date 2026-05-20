"use client";

import { useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { Button, Card, Pill } from "@/components/ui";
import { useApp } from "@/state/app-state";
import { DEFAULT_CHAIN_ID } from "@/config/chains";
import type { Tier } from "@/types";

const EXAMPLES: Record<Tier, string[]> = {
  preservation: [
    "$1,000 USDC, principal preservation first",
    "Highest-grade lending only, no loss tolerated",
  ],
  conservative: [
    "$2,000 USDC, lowest-risk yield",
    "Park 5,000 USDC for 3 months, stables only",
  ],
  balanced: [
    "$3,000 USDC, want yield for 6 months",
    "Put 10k USDC into a blue-chip LP",
  ],
  aggressive: [
    "Highest APR I can get on USDC, 1 year horizon",
    "Aerodrome emissions farm, no leverage",
  ],
  degen: [
    "Leveraged farm with 2x on USDC, points hunting",
    "Loop borrowing for max yield",
  ],
};

const CHAR_LIMIT = 500;

export function IntentInput() {
  const { state, dispatch } = useApp();
  const tier = state.tier?.tier ?? "balanced";
  const { address, chainId } = useAccount();
  const balance = useBalance({ address });
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    // Wallet is optional at plan-build time. The composer hydrates calldata
    // with the burn placeholder so the user can preview the full pipeline;
    // sign-time gates wallet connect + re-hydrates with the real address.
    const PREVIEW_ADDRESS = "0x000000000000000000000000000000000000dEaD" as const;
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tier,
          rawScore: state.tier?.rawScore ?? 20,
          literacyScore: state.answers?.literacy ?? 2,
          derivativeExpScore: state.answers?.derivativeExp ?? 1,
          vulnerableConsumer:
            (state.answers?.ageBucket ?? "under65") === "over65" ||
            (state.answers?.firstTimeDefiPilot ?? false),
          intentText: text,
          wallet: {
            address: address ?? PREVIEW_ADDRESS,
            chainId: chainId ?? DEFAULT_CHAIN_ID,
            gasBalanceWei: balance.data?.value.toString() ?? "0",
            holdings: [],
          },
        }),
      });
      const data = (await res.json()) as { plan?: unknown; error?: string };
      if (!res.ok) {
        setError(data.error ?? "We couldn't build a safe plan for that.");
        setLoading(false);
        return;
      }
      const plan = (data.plan ?? null) as import("@/types").PipelinePlan | null;
      if (!plan) {
        setError("Server returned an empty plan.");
        setLoading(false);
        return;
      }
      dispatch({ type: "SET_PLAN", plan });
    } catch (err) {
      setError((err as Error).message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-3xl flex-col px-6 py-12">
      <Pill>Intent · {tier}</Pill>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        What do you want to do with your capital?
      </h1>
      <p className="mt-2 text-sm text-[color:var(--color-fg-muted)]">
        Plain English. We&apos;ll translate it into a plan that fits your tier
        and runs as a dry-run before you sign anything.
      </p>
      <Card className="mt-6">
        <textarea
          value={text}
          maxLength={CHAR_LIMIT}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              if (text.trim().length >= 3 && !loading) void submit();
            }
          }}
          placeholder="e.g. $3,000 USDC, want yield for ~6 months"
          rows={4}
          className="panel-2 w-full resize-none rounded-md p-3 text-sm focus-ring focus:outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--color-fg-muted)]">
          <span className="tabular-nums">{text.length} / {CHAR_LIMIT}</span>
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-panel-2)] px-1.5 py-0.5 font-mono text-[10px]">⌘↵</kbd>
            <span>to build</span>
          </span>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-[color:var(--color-fg-muted)]">
            Examples for {tier}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES[tier].map((ex) => (
              <button
                key={ex}
                onClick={() => setText(ex)}
                className="panel-2 px-3 py-1.5 text-xs hover:border-[color:var(--color-accent)]/40"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <div className="panel-2 border-[color:var(--color-danger)]/40 text-sm text-[color:var(--color-danger)] p-3">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={() => dispatch({ type: "GOTO", stage: "tier-result" })}>
            Back
          </Button>
          <Button onClick={submit} disabled={loading || text.trim().length < 3}>
            {loading ? "Building plan…" : "Build plan"}
          </Button>
        </div>
      </Card>
    </main>
  );
}

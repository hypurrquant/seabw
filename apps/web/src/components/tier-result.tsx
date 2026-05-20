"use client";

import { useEffect, useState } from "react";
import { Button, Card, Pill } from "@/components/ui";
import { useApp } from "@/state/app-state";
import {
  TIER_APR_RANGE,
  TIER_LABEL,
  TIER_ORDER,
  TIER_TAGLINE,
} from "@seabw/core";
import type { Tier } from "@seabw/core";
import { cn } from "@/lib/utils";
import Link from "next/link";

const TIER_COLOR: Record<Tier, string> = {
  preservation: "text-[color:var(--color-conservative)]",
  conservative: "text-[color:var(--color-conservative)]",
  balanced: "text-[color:var(--color-balanced)]",
  aggressive: "text-[color:var(--color-aggressive)]",
  degen: "text-[color:var(--color-degen)]",
};

const PREV_TIER_KEY = "defipilot:prevTier";

export function TierResultView() {
  const { state, dispatch } = useApp();
  const tier = state.tier;
  const [upgradedFrom, setUpgradedFrom] = useState<Tier | null>(null);

  useEffect(() => {
    if (!tier || typeof window === "undefined") return;
    const prev = window.localStorage.getItem(PREV_TIER_KEY) as Tier | null;
    if (prev && TIER_ORDER.indexOf(tier.tier) > TIER_ORDER.indexOf(prev)) {
      setUpgradedFrom(prev);
    } else {
      setUpgradedFrom(null);
    }
    window.localStorage.setItem(PREV_TIER_KEY, tier.tier);
  }, [tier]);

  if (!tier) return null;
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-3xl flex-col items-center px-6 py-12">
      <Pill>Your tier · KOFIA 5-tier model</Pill>
      <h1 className={cn("mt-4 text-4xl md:text-5xl font-semibold tracking-tight text-center", TIER_COLOR[tier.tier])}>
        {TIER_LABEL[tier.tier]}
      </h1>
      <p className="mt-3 text-sm text-[color:var(--color-fg-muted)]">
        raw score {tier.rawScore} · est. {TIER_APR_RANGE[tier.tier]} APR range
      </p>
      <Card className="mt-8 w-full">
        <div className="text-sm text-[color:var(--color-fg)]">{TIER_TAGLINE[tier.tier]}</div>

        {tier.downgradedFromDegen && (
          <div className="panel-2 border-[color:var(--color-warning)]/40 p-4">
            <div className="text-xs uppercase tracking-wider text-[color:var(--color-warning)]">
              Degen gate not met — adjusted to Aggressive
            </div>
            <p className="mt-1 text-sm">{tier.reason}</p>
            <Link href="/risks" className="mt-1 inline-block text-xs underline text-[color:var(--color-fg-muted)]">
              Read the DeFi risk page →
            </Link>
          </div>
        )}

        {tier.vulnerableDowngrade && (
          <div className="panel-2 border-[color:var(--color-warning)]/40 p-4">
            <div className="text-xs uppercase tracking-wider text-[color:var(--color-warning)]">
              Vulnerable-consumer auto-downgrade
            </div>
            <p className="mt-1 text-sm">
              {tier.reason ?? "Age 65+ or first-time DeFi self-check triggered a one-tier protective downgrade."}
            </p>
          </div>
        )}

        {upgradedFrom && !tier.downgradedFromDegen && !tier.vulnerableDowngrade && (
          <div className="panel-2 border-[color:var(--color-warning)]/40 p-4">
            <div className="text-xs uppercase tracking-wider text-[color:var(--color-warning)]">
              Tier moved up: {TIER_LABEL[upgradedFrom]} → {TIER_LABEL[tier.tier]}
            </div>
            <p className="mt-1 text-sm">
              Higher tiers unlock higher APR but also unlock new risk surfaces.
              Make sure you can explain IL · Rug pull · MEV before signing anything.
            </p>
            <Link href="/risks" className="mt-1 inline-block text-xs underline text-[color:var(--color-fg-muted)]">
              Read the DeFi risk page →
            </Link>
          </div>
        )}

        <AllocationPreview tier={tier.tier} />

        <div className="grid grid-cols-2 gap-3 text-xs">
          <Bound label="Max leverage" value={tier.tier === "degen" ? "3x" : "1x (none)"} />
          <Bound label="Max protocols" value={protoCap(tier.tier)} />
          <Bound label="Bridges" value={bridgeCap(tier.tier)} />
          <Bound label="LP cap" value={lpCap(tier.tier)} />
        </div>

        <div className="pt-2 flex flex-col gap-3">
          <div className="text-xs uppercase tracking-wider text-[color:var(--color-fg-muted)]">
            How should we deploy your stablecoins?
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              onClick={() => {
                dispatch({ type: "SET_MODE", mode: "robo" });
                dispatch({ type: "GOTO", stage: "intent" });
              }}
              className="panel-2 p-4 text-left hover:border-[color:var(--color-accent)]/60"
            >
              <div className="text-sm font-medium">AI picks for me</div>
              <p className="mt-1 text-xs text-[color:var(--color-fg-muted)]">
                Type an intent, get a tier-compliant plan auto-built. Best when DeFi is new.
              </p>
            </button>
            <button
              onClick={() => {
                dispatch({ type: "SET_MODE", mode: "marketplace" });
                dispatch({ type: "GOTO", stage: "marketplace" });
              }}
              className="panel-2 p-4 text-left hover:border-[color:var(--color-accent)]/60"
            >
              <div className="text-sm font-medium">I&apos;ll compare myself</div>
              <p className="mt-1 text-xs text-[color:var(--color-fg-muted)]">
                Pick pools yourself in a marketplace and basket them. Danawa / Amazon style.
              </p>
            </button>
          </div>
          <Button variant="ghost" className="self-start" onClick={() => dispatch({ type: "GOTO", stage: "survey" })}>
            ← Retake the survey
          </Button>
        </div>
      </Card>
    </main>
  );
}

// Max share of stablecoin capital this tier may move out of stable lending and
// into LP / volatile positions. The remainder stays in stablecoin lending.
const LP_CAP_PCT: Record<Tier, number> = {
  preservation: 0,
  conservative: 20,
  balanced: 60,
  aggressive: 80,
  degen: 100,
};

function AllocationPreview({ tier }: { tier: Tier }) {
  const lpPct = LP_CAP_PCT[tier];
  const stablePct = 100 - lpPct;
  return (
    <div className="panel-2 flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">How far your stablecoins can travel</span>
        <span className="text-[color:var(--color-fg-muted)]">
          {tier === "degen" ? "up to 100% + leverage" : `up to ${lpPct}% into LP`}
        </span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--color-border)]">
        {stablePct > 0 && (
          <div
            className="h-full bg-[color:var(--color-success)]"
            style={{ width: `${stablePct}%` }}
          />
        )}
        {lpPct > 0 && (
          <div
            className={cn("h-full", TIER_BAR[tier])}
            style={{ width: `${lpPct}%` }}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[color:var(--color-fg-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[color:var(--color-success)]" />
          {stablePct}% stablecoin lending
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", TIER_BAR[tier])} />
          {tier === "degen" ? "LP / leveraged farming" : `${lpPct}% LP / volatile`}
        </span>
      </div>
    </div>
  );
}

const TIER_BAR: Record<Tier, string> = {
  preservation: "bg-[color:var(--color-conservative)]",
  conservative: "bg-[color:var(--color-conservative)]",
  balanced: "bg-[color:var(--color-balanced)]",
  aggressive: "bg-[color:var(--color-aggressive)]",
  degen: "bg-[color:var(--color-degen)]",
};

function Bound({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-2 p-3">
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function protoCap(t: Tier): string {
  return ({
    preservation: "1",
    conservative: "2",
    balanced: "3",
    aggressive: "5",
    degen: "8",
  } as const)[t];
}
function bridgeCap(t: Tier): string {
  return ({
    preservation: "0",
    conservative: "0",
    balanced: "1 (major chains)",
    aggressive: "2",
    degen: "2",
  } as const)[t];
}
function lpCap(t: Tier): string {
  return ({
    preservation: "0%",
    conservative: "20%",
    balanced: "60%",
    aggressive: "80%",
    degen: "no cap",
  } as const)[t];
}

"use client";

import {
  ArrowRight,
  BadgeCheck,
  Layers,
  LineChart,
  Network,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { Button, Pill } from "@/components/ui";
import { useApp } from "@/state/app-state";

export function Landing() {
  const { dispatch } = useApp();
  return (
    <main className="mx-auto w-full max-w-[1400px] px-6 pt-10 pb-24 sm:pt-14 md:px-10">
      {/* HERO — asymmetric 60/40 split. Text reads left, a live-preview card
          anchors the right. Collapses to single-column < md (skill rule 3). */}
      <section className="grid grid-cols-1 items-start gap-12 md:grid-cols-[1.4fr_1fr] md:gap-14">
        <div className="flex flex-col gap-6 pt-6 md:pt-12">
          <Pill className="w-fit">
            <ShieldCheck size={11} strokeWidth={2} className="mr-0.5" />
            Stablecoin robo-advisor · KOFIA 5-tier · 5 chains
          </Pill>
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            Put your stablecoins to work.
            <span className="block text-[color:var(--color-accent)]">
              We&apos;ll draft the plan.
            </span>
          </h1>
          <p className="max-w-[55ch] text-base leading-relaxed text-[color:var(--color-fg-muted)] md:text-lg">
            Hold USDC, USDT, or DAI? Tell us your risk profile and how much you
            want to deploy. We draft a tier-compliant plan — lending, LP, only
            the swaps the strategy needs — and you sign it from your own wallet.
          </p>
          <div className="mt-2 flex flex-col gap-3">
            <Button
              size="lg"
              onClick={() => dispatch({ type: "GOTO", stage: "survey" })}
              className="group w-fit"
            >
              Start the 1-page risk quiz
              <ArrowRight
                size={16}
                strokeWidth={2}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Button>
            <p className="text-xs text-[color:var(--color-fg-muted)]">
              No wallet, no email. ~60 seconds.
            </p>
          </div>
          {/* Stat strip — singular typographic moment with mono numbers
              (skill Rule "Tiny paddings; no card boxes; just 1px lines"). */}
          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-[color:var(--color-border)] pt-6 sm:grid-cols-4">
            <Stat label="Chains" value="5" hint="HyperEVM · Mantle · Base · BNB · Monad" />
            <Stat label="Protocols" value="38" hint="lending · LP · vault · DEX" />
            <Stat label="Tests" value="151" hint="unit · integration · e2e" />
            <Stat label="Tiers" value="5" hint="KOFIA-mapped" />
          </dl>
        </div>

        {/* RIGHT — Live-preview asymmetric showcase. Pinned offset down so the
            top of the hero feels intentionally lopsided. */}
        <PlanPreviewMock />
      </section>

      {/* HOW IT WORKS — zig-zag (NOT 3-col card grid; skill ban). Uses
          border-t + negative-space grouping instead of card boxes. */}
      <section className="mt-28 md:mt-36">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <span className="text-xs uppercase tracking-[0.12em] text-[color:var(--color-fg-muted)]">
              How it works
            </span>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              Three steps. One sign at the end.
            </h2>
          </div>
          <p className="hidden max-w-sm text-sm text-[color:var(--color-fg-muted)] md:block">
            Preview the full multi-step pipeline first — calldata only rebinds
            to your wallet when you actually hit Approve.
          </p>
        </div>

        <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-[color:var(--color-border)] md:grid-cols-[2fr_1.6fr_1.4fr]">
          <Step
            n="01"
            title="Profile + amount"
            body="Eight KOFIA-style questions, a vulnerable-consumer check, and how much stablecoin you want to deploy. Cached 24 months."
            icon={<ShieldCheck size={20} strokeWidth={1.75} />}
          />
          <Step
            n="02"
            title="Two ways to plan"
            body="Type an intent and let it auto-build, or browse pools and assemble a basket — both start from your stables and share the same guardrails."
            icon={<Wand2 size={20} strokeWidth={1.75} />}
          />
          <Step
            n="03"
            title="Sign with your wallet"
            body="Calldata stays server-canonical. Every signature runs a fresh precheck against the live store."
            icon={<BadgeCheck size={20} strokeWidth={1.75} />}
          />
        </ol>
      </section>

      {/* WHAT'S INSIDE — features as 2-col zig-zag (skill section 7 explicitly
          bans the 3-col equal-card layout). Mobile collapses naturally. */}
      <section className="mt-28 md:mt-32">
        <h2 className="mb-10 max-w-2xl text-2xl font-semibold tracking-tight md:text-3xl">
          Built for people who&apos;d rather not babysit a DeFi position at 2&nbsp;a.m.
        </h2>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-[color:var(--color-border)] md:grid-cols-2">
          <Feature
            icon={<Layers size={18} strokeWidth={1.75} />}
            title="Stable-first, tier-bound"
            body="Low tiers keep your principal in stablecoin lending; higher tiers swap only a capped slice into LP. Caps, leverage ceilings, and audit floors apply before the first APR shows."
          />
          <Feature
            icon={<Network size={18} strokeWidth={1.75} />}
            title="Multi-chain, multi-aggregator"
            body="defi-cli routes through LI.FI, KyberSwap, OpenOcean. Native wrapping handled (ETH ↔ WETH, BNB ↔ WBNB)."
          />
          <Feature
            icon={<LineChart size={18} strokeWidth={1.75} />}
            title="V3 ranges, variance-aware"
            body="Tight 50 / medium 30 / wide 20 splits — auto-picked based on the pool's APR variance, not a guess."
          />
          <Feature
            icon={<ShieldCheck size={18} strokeWidth={1.75} />}
            title="Wallet only at the very end"
            body="Plan with a burn placeholder. Connect on Approve & sign. Rebind, re-verify, then a single Wallet prompt per step."
          />
        </div>
      </section>

      {/* Operational disclosures — quiet trailing strip. */}
      <section className="mt-24 grid grid-cols-1 gap-3 border-t border-[color:var(--color-border)] pt-8 text-xs text-[color:var(--color-fg-muted)] sm:grid-cols-2 md:grid-cols-4">
        <Disclosure>APRs are estimates. Never guaranteed.</Disclosure>
        <Disclosure>Sanctions check + kill-switch on every sign.</Disclosure>
        <Disclosure>Plan + calldata stale after 5 min — server forces rebuild.</Disclosure>
        <Disclosure>You sign each step. We never hold your keys.</Disclosure>
      </section>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-fg-muted)]">
        {label}
      </dt>
      <dd className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-[color:var(--color-fg)]">
        {value}
      </dd>
      <dd className="text-[11px] text-[color:var(--color-fg-muted)]">{hint}</dd>
    </div>
  );
}

function Step({
  n,
  title,
  body,
  icon,
}: {
  n: string;
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 bg-[color:var(--color-panel)] p-6 md:p-8">
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-[color:var(--color-fg-muted)]">{n}</span>
        <span className="text-[color:var(--color-accent)]">{icon}</span>
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="text-sm leading-relaxed text-[color:var(--color-fg-muted)]">{body}</p>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4 bg-[color:var(--color-panel)] p-6 md:p-8">
      <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-md bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]">
        {icon}
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <p className="text-sm leading-relaxed text-[color:var(--color-fg-muted)]">{body}</p>
      </div>
    </div>
  );
}

function Disclosure({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[color:var(--color-accent)]/60" />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

// Tiny static mock of a Plan-Review DAG that anchors the right side of the
// hero. Pure markup, no defi-cli — gives the centered text a visual partner so
// the hero stops feeling like a brochure.
function PlanPreviewMock() {
  const steps = [
    { kind: "Lend", proto: "Aave V3", asset: "USDC", apr: "5.2%" },
    { kind: "Swap", proto: "LI.FI", asset: "USDC → WETH", apr: "0.08% fee" },
    { kind: "LP add", proto: "Aerodrome", asset: "WETH/USDC", apr: "11.4%" },
  ];
  return (
    <div className="relative pt-6 md:pt-12">
      {/* Soft accent halo behind the card stack — subtle, no neon glow. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[28px] bg-[color:var(--color-accent)]/8 blur-2xl"
      />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between gap-2 px-1 text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-fg-muted)]">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]" />
            Balanced · Base
          </span>
          <span className="font-mono normal-case tracking-normal text-[color:var(--color-fg)]">
            Start: 3,000 USDC
          </span>
        </div>
        <div className="panel flex flex-col gap-3 p-4 md:p-5">
          {steps.map((s, i) => (
            <div
              key={s.kind}
              className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel-2)]/60 p-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-[color:var(--color-accent)]/10 font-mono text-xs text-[color:var(--color-accent)]">
                  {i + 1}
                </span>
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wider text-[color:var(--color-fg-muted)]">
                    {s.kind}
                  </span>
                  <span className="text-sm font-medium">{s.proto}</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-[color:var(--color-fg-muted)]">{s.asset}</span>
                <span className="font-mono text-xs tabular-nums text-[color:var(--color-fg)]">
                  {s.apr}
                </span>
              </div>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between border-t border-[color:var(--color-border)] pt-3 text-xs">
            <span className="text-[color:var(--color-fg-muted)]">Aggregate APR (est.)</span>
            <span className="font-mono font-semibold text-[color:var(--color-fg)]">8.2%</span>
          </div>
        </div>
        <div className="mt-3 px-1 text-[11px] text-[color:var(--color-fg-muted)]">
          Mocked for illustration — your real plan is built from live defi-cli quotes.
        </div>
      </div>
    </div>
  );
}

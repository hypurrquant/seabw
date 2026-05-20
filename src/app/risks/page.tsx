import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  Cable,
  Crosshair,
  Flame,
  ShieldCheck,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { Pill } from "@/components/ui";

interface RiskCard {
  name: string;
  icon: LucideIcon;
  desc: string;
  bound: string;
}

const RISKS: RiskCard[] = [
  {
    name: "Smart-contract bugs",
    icon: Bug,
    desc: "A bug in protocol code can drain funds. Even stablecoin lending markets run on contracts that can fail.",
    bound: "Audited-protocols whitelist per tier (TVL, age, named auditors). No audit eliminates the risk.",
  },
  {
    name: "Impermanent loss (IL)",
    icon: TrendingDown,
    desc: "An LP holds two assets. When one moves in price vs. the other, the position is worth less than simply holding both. IL is a real USD loss even when fees offset part of it.",
    bound: "Lower tiers keep your stablecoins in lending and never enter LP. Higher tiers cap the LP share.",
  },
  {
    name: "Rug pulls",
    icon: AlertTriangle,
    desc: "A team or pool deployer can drain liquidity if the code allows it — unrenounced ownership, mintable supply, hidden privileged functions.",
    bound: "Only vetted protocols are eligible; fresh or unaudited pools are flagged and gated by tier.",
  },
  {
    name: "MEV (Maximal Extractable Value)",
    icon: Crosshair,
    desc: "Searchers and validators reorder, insert, or front-run your transactions to extract profit at your expense. Worst on Ethereum mainnet.",
    bound: "Mainnet steps route through a private RPC, and per-asset slippage caps limit the damage.",
  },
  {
    name: "Liquidation in leveraged positions",
    icon: Flame,
    desc: "Borrow positions can be force-closed when collateral value drops, locking in losses plus penalty fees.",
    bound: "Only Degen tier permits leverage, and never above 3x. Every other tier is unleveraged.",
  },
  {
    name: "Bridge & oracle risk",
    icon: Cable,
    desc: "Cross-chain bridges and price oracles are concentrated attack surfaces with a history of nine-figure exploits.",
    bound: "Bridge hops are capped by tier and long-tail oracles are avoided.",
  },
];

export default function RisksPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1.5 text-xs text-[color:var(--color-fg-muted)] transition-colors hover:text-[color:var(--color-fg)]"
      >
        <ArrowLeft size={13} strokeWidth={2} />
        Back to DefiPilot
      </Link>

      <header className="flex flex-col gap-3">
        <Pill className="w-fit">
          <ShieldCheck size={11} strokeWidth={2} className="mr-0.5" />
          Know the risk before you deploy
        </Pill>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          DeFi risks, and how we bound them
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[color:var(--color-fg-muted)]">
          Putting stablecoins to work is never zero-risk — even stable lending
          runs on smart contracts. DefiPilot doesn&apos;t remove these risks; it
          shapes the surface so the trades you take stay bounded by your tier.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-[color:var(--color-border)]">
        {RISKS.map((r) => {
          const Icon = r.icon;
          return (
            <li key={r.name} className="flex gap-4 bg-[color:var(--color-panel)] p-5 md:p-6">
              <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-md bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]">
                <Icon size={18} strokeWidth={1.75} />
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-base font-semibold tracking-tight">{r.name}</h2>
                <p className="text-sm leading-relaxed text-[color:var(--color-fg-muted)]">
                  {r.desc}
                </p>
                <div className="flex items-start gap-2 rounded-md bg-[color:var(--color-success)]/8 px-3 py-2 text-xs text-[color:var(--color-fg)]">
                  <ShieldCheck
                    size={13}
                    strokeWidth={2}
                    className="mt-0.5 flex-none text-[color:var(--color-success)]"
                  />
                  <span>
                    <span className="font-medium text-[color:var(--color-success)]">How we bound it: </span>
                    {r.bound}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-[color:var(--color-border)] pt-6 text-xs leading-relaxed text-[color:var(--color-fg-muted)]">
        APR figures shown anywhere in DefiPilot are estimated from on-chain data
        and protocol-emissions schedules. They are not guarantees. Past
        emissions do not predict future emissions.
      </p>
    </main>
  );
}

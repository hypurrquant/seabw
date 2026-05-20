import Link from "next/link";

const RISKS = [
  {
    name: "Smart-contract bugs",
    desc: "A bug in protocol code can drain funds. DefiPilot mitigates this by enforcing an audited-protocols whitelist per tier, but no audit eliminates risk.",
  },
  {
    name: "Impermanent loss (IL)",
    desc: "An LP holds two assets. When one moves in price vs. the other, the LP position is worth less than simply holding the two assets. IL is a real loss in USD terms even when fees offset it.",
  },
  {
    name: "Rug pulls",
    desc: "A protocol team or pool deployer can drain liquidity if the code allows it (e.g. unrenounced ownership, mintable supply, hidden privileged functions).",
  },
  {
    name: "MEV (Maximal Extractable Value)",
    desc: "Searchers and validators reorder, insert, or front-run your transactions to extract profit at your expense. Worst on Ethereum mainnet; mitigated by private RPCs.",
  },
  {
    name: "Liquidation in leveraged positions",
    desc: "Borrow positions can be force-closed when collateral value drops, locking in losses and incurring penalty fees. Only Degen tier permits leverage; never exceeds 3x.",
  },
  {
    name: "Bridge & oracle risk",
    desc: "Cross-chain bridges and price oracles are concentrated attack surfaces. DefiPilot caps bridge hops by tier and avoids long-tail oracles.",
  },
];

export default function RisksPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <Link href="/" className="text-xs text-[color:var(--color-fg-muted)] underline">
        ← back to DefiPilot
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">DeFi risks</h1>
      <p className="text-sm text-[color:var(--color-fg-muted)]">
        DefiPilot does not eliminate risk — it shapes the surface so the trades
        you take are bounded by your tier. Read these before answering Q5.
      </p>
      <ul className="flex flex-col gap-3">
        {RISKS.map((r) => (
          <li key={r.name} className="panel p-5">
            <div className="text-sm font-medium">{r.name}</div>
            <p className="mt-1 text-sm text-[color:var(--color-fg-muted)]">{r.desc}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[color:var(--color-fg-muted)]">
        APR figures shown anywhere in DefiPilot are estimated from on-chain data
        and protocol-emissions schedules. They are not guarantees. Past
        emissions do not predict future emissions.
      </p>
    </main>
  );
}

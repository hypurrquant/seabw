"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { Button, Card, Pill } from "@/components/ui";
import { CHAINS, DEFI_CLI_CHAIN_IDS, chainName } from "@/config/chains";
import { formatPct, formatUsd, truncateAddress } from "@/lib/utils";
import type { PortfolioHealth, Severity } from "@/lib/risk";

export const dynamic = "force-dynamic";

// Static prerender can't supply a WagmiProvider; the providers component
// gates it behind a mount effect. We mirror that here so useAccount only fires
// after hydration on the client.
export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <Pill>Portfolio risk · on-chain snapshot</Pill>
        <h1 className="text-3xl font-semibold tracking-tight">Position health dashboard</h1>
        <p className="text-sm text-[color:var(--color-fg-muted)]">Loading…</p>
      </main>
    );
  }
  return <PortfolioPage />;
}

const SEVERITY_TONE: Record<Severity, "default" | "warn" | "danger" | "ok"> = {
  ok: "ok",
  watch: "warn",
  warn: "warn",
  danger: "danger",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  ok: "OK",
  watch: "Watch",
  warn: "Warn",
  danger: "Danger",
};

const CHAIN_CHOICES = [...DEFI_CLI_CHAIN_IDS];

function PortfolioPage() {
  const { address: connectedAddress } = useAccount();
  const [address, setAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(8453);
  const [health, setHealth] = useState<PortfolioHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connectedAddress && !address) setAddress(connectedAddress);
  }, [connectedAddress, address]);

  const fetchHealth = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/health?address=${address}&chainId=${chainId}`);
      const data = (await res.json()) as { health?: PortfolioHealth; error?: string };
      if (!res.ok) {
        setError(data.error ?? `Server returned ${res.status}`);
        setHealth(null);
        return;
      }
      setHealth(data.health ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [address, chainId]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 pb-24">
      <header className="flex flex-col gap-3">
        <Pill>Portfolio risk · on-chain snapshot</Pill>
        <h1 className="text-3xl font-semibold tracking-tight">
          Position health dashboard
        </h1>
        <p className="text-sm text-[color:var(--color-fg-muted)]">
          Reads your live on-chain positions via defi-cli and flags lending health, LP
          range exposure, and token concentration. No transactions are sent.
        </p>
      </header>

      <Card title="Query" description="Wallet + chain to inspect">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex w-full flex-col gap-1 sm:w-auto">
            <span className="text-xs uppercase tracking-wider text-[color:var(--color-fg-muted)]">
              Wallet address
            </span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x…"
              className="panel-2 w-full rounded-md p-2 text-sm focus-ring focus:outline-none sm:w-[36ch]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-[color:var(--color-fg-muted)]">
              Chain
            </span>
            <select
              value={chainId}
              onChange={(e) => setChainId(Number(e.target.value))}
              className="panel-2 rounded-md p-2 text-sm"
            >
              {CHAIN_CHOICES.map((c) => (
                <option key={c} value={c}>
                  {chainName(c)}
                </option>
              ))}
            </select>
          </label>
          <Button
            onClick={fetchHealth}
            disabled={loading || !address || !/^0x[a-fA-F0-9]{40}$/.test(address)}
          >
            {loading ? "Loading…" : health ? "Refresh" : "Fetch positions"}
          </Button>
          {connectedAddress && address !== connectedAddress && (
            <Button variant="ghost" onClick={() => setAddress(connectedAddress)}>
              Use connected wallet
            </Button>
          )}
        </div>
        {!connectedAddress && (
          <p className="text-[10px] text-[color:var(--color-fg-muted)]">
            Tip: paste any address (try the burn address{" "}
            <code className="font-mono">0x...dEaD</code> for a non-empty Base demo).
          </p>
        )}
      </Card>

      {error && (
        <Card>
          <div className="panel-2 border-[color:var(--color-danger)]/40 p-3 text-sm text-[color:var(--color-danger)]">
            {error}
          </div>
        </Card>
      )}

      {health && <HealthView health={health} />}

      <div className="mt-6 flex items-center justify-between text-xs text-[color:var(--color-fg-muted)]">
        <Link href="/" className="underline">
          ← back to DefiPilot
        </Link>
        <span>defi-cli snapshot · refresh manually as needed</span>
      </div>
    </main>
  );
}

function HealthView({ health }: { health: PortfolioHealth }) {
  return (
    <>
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-[color:var(--color-fg-muted)]">
              {health.chainName} · {truncateAddress(health.address)}
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {formatUsd(health.totalValueUsd)}
            </div>
            <div className="text-xs text-[color:var(--color-fg-muted)]">
              Native: {health.nativeBalance.toFixed(4)} (
              {formatUsd(health.nativeValueUsd)})
            </div>
          </div>
          <Pill tone={SEVERITY_TONE[health.worstSeverity]}>
            Overall: {SEVERITY_LABEL[health.worstSeverity]}
          </Pill>
        </div>
        {health.flags.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-xs">
            {health.flags.map((f) => (
              <li key={f} className="panel-2 px-2 py-1">
                · {f}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Token balances" description="Sorted by USD value; concentration flagged at >60%">
        {health.tokens.length === 0 ? (
          <p className="text-sm text-[color:var(--color-fg-muted)]">
            No token balances detected.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-1 text-xs">
            <div className="grid grid-cols-[1fr_68px_56px_60px] sm:grid-cols-[1fr_100px_80px_80px] gap-2 px-2 py-1 text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)]">
              <div>Token</div>
              <div className="text-right">Value</div>
              <div className="text-right">Share</div>
              <div className="text-right">Flag</div>
            </div>
            {health.tokens.slice(0, 12).map((t) => (
              <div
                key={t.symbol}
                className="grid grid-cols-[1fr_68px_56px_60px] sm:grid-cols-[1fr_100px_80px_80px] items-center gap-2 panel-2 px-2 py-1"
              >
                <div className="font-medium">{t.symbol}</div>
                <div className="text-right">{formatUsd(t.valueUsd)}</div>
                <div className="text-right">{formatPct(t.sharePct, 1)}</div>
                <div className="text-right">
                  <Pill tone={SEVERITY_TONE[t.severity]}>
                    {SEVERITY_LABEL[t.severity]}
                  </Pill>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Lending positions" description="Health factor banded ok ≥1.5 / watch ≥1.2 / warn ≥1.1 / danger <1.1">
        {health.lending.length === 0 ? (
          <p className="text-sm text-[color:var(--color-fg-muted)]">
            No lending positions on this chain.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {health.lending.map((l) => (
              <li key={l.protocol} className="panel-2 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{l.protocol}</div>
                  <Pill tone={SEVERITY_TONE[l.severity]}>{SEVERITY_LABEL[l.severity]}</Pill>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-3 text-xs">
                  <Metric label="Collateral" value={formatUsd(l.collateralUsd)} />
                  <Metric label="Debt" value={formatUsd(l.debtUsd)} />
                  <Metric
                    label="Health factor"
                    value={l.healthFactor === null ? "—" : l.healthFactor.toFixed(2)}
                  />
                </div>
                <p className="mt-1 text-[10px] text-[color:var(--color-fg-muted)]">
                  {l.note}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="LP positions (V3 NFTs)" description="Range width heuristic; verify in-range on protocol UI before action">
        {health.lp.length === 0 ? (
          <p className="text-sm text-[color:var(--color-fg-muted)]">
            No LP NFTs detected on this chain.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {health.lp.slice(0, 20).map((l, i) => (
              <li key={`${l.protocol}-${l.tokenId ?? i}`} className="panel-2 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {l.protocol} · #{l.tokenId ?? "?"}
                  </div>
                  <Pill tone={SEVERITY_TONE[l.severity]}>{SEVERITY_LABEL[l.severity]}</Pill>
                </div>
                <div className="mt-1 text-xs text-[color:var(--color-fg-muted)]">
                  Pair: {l.pair}
                </div>
                {l.tickRange && (
                  <div className="mt-1 text-[10px] text-[color:var(--color-fg-muted)]">
                    Tick range [{l.tickRange.lower} … {l.tickRange.upper}] (width{" "}
                    {l.tickRange.width})
                  </div>
                )}
                <p className="mt-1 text-[10px] text-[color:var(--color-fg-muted)]">
                  {l.note}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)]">
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

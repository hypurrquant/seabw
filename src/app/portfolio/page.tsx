"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import Link from "next/link";
import { LineChart, Wallet } from "lucide-react";
import { Button, Card, Pill } from "@/components/ui";
import { CHAINS, DEFI_CLI_CHAIN_IDS, chainName } from "@/config/chains";
import { cn, formatPct, formatUsd, truncateAddress } from "@/lib/utils";
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
  const { connectors, connect, isPending: connecting, error: connectError } = useConnect();
  const [address, setAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(8453);
  const [health, setHealth] = useState<PortfolioHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickWallet, setPickWallet] = useState(false);
  const pendingAutoFetch = useRef(false);

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

  // On connect: close the picker, auto-fill the address, and arm a one-shot
  // auto-fetch so the user lands on their positions instead of an empty form.
  useEffect(() => {
    if (!connectedAddress) return;
    setPickWallet(false);
    if (!address) {
      setAddress(connectedAddress);
      pendingAutoFetch.current = true;
    }
  }, [connectedAddress, address]);

  useEffect(() => {
    if (pendingAutoFetch.current && address === connectedAddress && !loading && !health) {
      pendingAutoFetch.current = false;
      void fetchHealth();
    }
  }, [address, connectedAddress, loading, health, fetchHealth]);

  const addressValid = /^0x[a-fA-F0-9]{40}$/.test(address);

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
            disabled={loading || !addressValid}
          >
            {loading ? "Loading…" : health ? "Refresh" : "Fetch positions"}
          </Button>
          {!connectedAddress && (
            <Button variant="secondary" onClick={() => setPickWallet(true)} disabled={connecting}>
              <Wallet size={15} strokeWidth={2} />
              {connecting ? "Connecting…" : "Connect wallet"}
            </Button>
          )}
          {connectedAddress && address !== connectedAddress && (
            <Button variant="ghost" onClick={() => setAddress(connectedAddress)}>
              Use connected wallet
            </Button>
          )}
        </div>
        {!connectedAddress && (
          <p className="text-[10px] text-[color:var(--color-fg-muted)]">
            Connect to auto-fill, or paste any address — try the burn address{" "}
            <code className="font-mono">0x…dEaD</code> for a non-empty Base demo.
          </p>
        )}
        {connectError && (
          <p className="text-[10px] text-[color:var(--color-danger)]">{connectError.message}</p>
        )}
      </Card>

      {error && (
        <Card>
          <div className="panel-2 border-[color:var(--color-danger)]/40 p-3 text-sm text-[color:var(--color-danger)]">
            {error}
          </div>
        </Card>
      )}

      {loading && !health && <HealthSkeleton />}

      {!loading && !health && !error && (
        <EmptyState
          hasWallet={Boolean(connectedAddress)}
          onConnect={() => setPickWallet(true)}
          onDemo={() => setAddress("0x000000000000000000000000000000000000dEaD")}
        />
      )}

      {health && <HealthView health={health} />}

      <div className="mt-6 flex items-center justify-between text-xs text-[color:var(--color-fg-muted)]">
        <Link href="/" className="underline">
          ← back to DefiPilot
        </Link>
        <span>defi-cli snapshot · refresh manually as needed</span>
      </div>

      {pickWallet && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[color:var(--color-fg)]/20 p-6 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between">
              <Pill>Connect wallet</Pill>
              <Button variant="ghost" size="sm" onClick={() => setPickWallet(false)}>
                Cancel
              </Button>
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Pick a wallet</h2>
            <p className="text-xs text-[color:var(--color-fg-muted)]">
              Read-only — we never send a transaction from this page. WalletConnect
              shows a QR for mobile wallets.
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
          </Card>
        </div>
      )}
    </main>
  );
}

function EmptyState({
  hasWallet,
  onConnect,
  onDemo,
}: {
  hasWallet: boolean;
  onConnect: () => void;
  onDemo: () => void;
}) {
  return (
    <Card className="items-center gap-4 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]">
        <LineChart size={24} strokeWidth={1.75} />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">No positions loaded yet</h2>
        <p className="mx-auto max-w-md text-sm text-[color:var(--color-fg-muted)]">
          Point the dashboard at any wallet to read its live lending health, LP
          range exposure, and token concentration. Nothing is signed or sent.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {!hasWallet && (
          <Button onClick={onConnect}>
            <Wallet size={15} strokeWidth={2} />
            Connect wallet
          </Button>
        )}
        <Button variant="secondary" onClick={onDemo}>
          Try the demo address
        </Button>
      </div>
    </Card>
  );
}

function HealthSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <div className="skeleton h-2.5 w-40" />
            <div className="skeleton h-7 w-32" />
            <div className="skeleton h-2.5 w-24" />
          </div>
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
      </Card>
      <Card title="Token balances">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "grid grid-cols-[1fr_68px_56px_60px] items-center gap-2",
                "sm:grid-cols-[1fr_100px_80px_80px]",
              )}
            >
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-3 w-14 justify-self-end" />
              <div className="skeleton h-3 w-10 justify-self-end" />
              <div className="skeleton h-5 w-12 justify-self-end rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
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

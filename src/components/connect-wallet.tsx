"use client";

import { useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button, Card, Pill } from "@/components/ui";
import { truncateAddress } from "@/lib/utils";
import { useApp } from "@/state/app-state";
import { chainName } from "@/config/chains";

export function ConnectWallet() {
  const { state, dispatch } = useApp();
  const { address, chainId, status } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (status === "connected" && address && state.stage === "connect-wallet") {
      const next = state.mode === "marketplace" ? "marketplace" : "intent";
      const t = setTimeout(() => dispatch({ type: "GOTO", stage: next }), 600);
      return () => clearTimeout(t);
    }
  }, [status, address, state.stage, state.mode, dispatch]);

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-2xl flex-col items-center px-6 py-12">
      <Pill>Connect wallet</Pill>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Connect your wallet</h1>
      <p className="mt-2 max-w-md text-center text-sm text-[color:var(--color-fg-muted)]">
        DefiPilot never holds your keys. We use your wallet to sign every
        transaction. Each step is shown before you sign it.
      </p>
      <Card className="mt-8 w-full items-center text-center">
        {status === "connected" && address ? (
          <>
            <div className="flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[color:var(--color-success)]"></span>
              <span className="text-sm">Connected · {truncateAddress(address)}</span>
            </div>
            <div className="text-xs text-[color:var(--color-fg-muted)]">
              {chainName(chainId ?? 0)}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Button
                onClick={() =>
                  dispatch({
                    type: "GOTO",
                    stage: state.mode === "marketplace" ? "marketplace" : "intent",
                  })
                }
              >
                Continue
              </Button>
              <Button variant="ghost" onClick={() => disconnect()}>
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-[color:var(--color-fg-muted)]">
              Pick a wallet. WalletConnect shows a QR for mobile wallets.
            </p>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {connectors.map((c) => (
                <Button
                  key={c.uid}
                  variant="secondary"
                  disabled={isPending}
                  onClick={() => connect({ connector: c })}
                  className="justify-between"
                >
                  <span>{c.name}</span>
                  <span className="text-[10px] text-[color:var(--color-fg-muted)]">
                    {c.type}
                  </span>
                </Button>
              ))}
            </div>
            {error && (
              <div className="panel-2 border-[color:var(--color-danger)]/40 text-xs text-[color:var(--color-danger)] p-2">
                {error.message}
              </div>
            )}
            <p className="text-[10px] text-[color:var(--color-fg-muted)]">
              By connecting, you confirm DefiPilot does not custody your assets.
            </p>
          </>
        )}
      </Card>
      <Button variant="ghost" className="mt-4" onClick={() => dispatch({ type: "GOTO", stage: "tier-result" })}>
        Back
      </Button>
    </main>
  );
}

"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button, Card } from "@/components/ui";
import { truncateAddress } from "@/lib/utils";
import { chainName } from "@/lib/chains";
import { useApp } from "@/state/app-state";
import { useSiweAuth } from "@/domains/auth/use-siwe-auth";

export interface ConnectWalletPanelProps {
  variant: "page" | "modal";
  onAuthed?: () => void;
}

export function ConnectWalletPanel({ variant, onAuthed }: ConnectWalletPanelProps) {
  const { state } = useApp();
  const { address, chainId, status } = useAccount();
  const { connectors, connect, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { authenticate, status: authStatus, error: authError } = useSiweAuth();

  // Auto-trigger onAuthed when authentication completes
  if (authStatus === "authed" && onAuthed) {
    queueMicrotask(onAuthed);
  }

  const isConnected = status === "connected" && !!address;
  const isAuthenticating = authStatus === "authenticating";
  const isAuthed = authStatus === "authed";

  return (
    <Card
      className={
        variant === "page" ? "mt-8 w-full items-center text-center" : "w-full"
      }
    >
      {!isConnected && (
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
          {connectError && (
            <div className="panel-2 border-[color:var(--color-danger)]/40 text-xs text-[color:var(--color-danger)] p-2">
              {connectError.message}
            </div>
          )}
          <p className="text-[10px] text-[color:var(--color-fg-muted)]">
            By connecting, you confirm DefiPilot does not custody your assets.
          </p>
        </>
      )}

      {isConnected && !isAuthed && (
        <>
          <div className="flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[color:var(--color-success)]"></span>
            <span className="text-sm">Connected · {truncateAddress(address)}</span>
          </div>
          <div className="text-xs text-[color:var(--color-fg-muted)]">
            {chainName(chainId ?? 0)}
          </div>
          <p className="text-sm text-[color:var(--color-fg-muted)]">
            Sign a one-time message to prove ownership. No transaction, no gas.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Button
              onClick={() => void authenticate()}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? "Open your wallet to sign…" : "Sign in to continue"}
            </Button>
            <Button variant="ghost" onClick={() => disconnect()} disabled={isAuthenticating}>
              Disconnect
            </Button>
          </div>
          {authError && (
            <div className="panel-2 border-[color:var(--color-danger)]/40 text-xs text-[color:var(--color-danger)] p-2">
              {authError}
            </div>
          )}
        </>
      )}

      {isAuthed && state.auth.ownerAddress && (
        <>
          <div className="flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[color:var(--color-success)]"></span>
            <span className="text-sm">
              Signed in · {truncateAddress(state.auth.ownerAddress)}
            </span>
          </div>
          <p className="text-xs text-[color:var(--color-fg-muted)]">
            {variant === "page"
              ? "Continuing to your investor survey…"
              : "You're all set."}
          </p>
        </>
      )}
    </Card>
  );
}

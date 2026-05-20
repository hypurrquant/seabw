"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui";
import { truncateAddress } from "@/lib/utils";
import { useApp } from "@/state/app-state";
import { useSiweAuth } from "@/domains/auth/use-siwe-auth";
import { useWalletModal } from "@/domains/wallet/wallet-modal-context";

export function WalletBadge() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-8 w-28" aria-hidden="true" />;
  return <WalletBadgeInner />;
}

function WalletBadgeInner() {
  const { state } = useApp();
  const { status: accountStatus, address } = useAccount();
  const { signOut } = useSiweAuth();
  const modal = useWalletModal();
  const [open, setOpen] = useState(false);

  const authedAddress =
    state.auth.status === "authed" ? state.auth.ownerAddress : undefined;
  const connected = accountStatus === "connected" && address;

  if (authedAddress) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-3 py-1.5 text-xs hover:border-[color:var(--color-accent)]/60"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]" />
          <span className="font-mono">{truncateAddress(authedAddress)}</span>
          <span className="text-[color:var(--color-fg-muted)]">⌄</span>
        </button>
        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-panel)] shadow-lg">
              <button
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="block w-full px-3 py-2 text-left text-xs hover:bg-[color:var(--color-panel-2)]"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (connected) {
    return (
      <Button size="sm" onClick={() => modal.open()}>
        Sign in
      </Button>
    );
  }

  return (
    <Button size="sm" variant="secondary" onClick={() => modal.open()}>
      Connect wallet
    </Button>
  );
}

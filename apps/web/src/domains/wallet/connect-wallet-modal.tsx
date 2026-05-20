"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";
import { useApp } from "@/state/app-state";
import { ConnectWalletPanel } from "./connect-wallet-panel";
import { useWalletModal } from "./wallet-modal-context";

export function ConnectWalletModal() {
  const { state } = useApp();
  const modal = useWalletModal();
  const isAuthenticating = state.auth.status === "authenticating";

  // Close modal once user is fully authed.
  useEffect(() => {
    if (modal.isOpen && state.auth.status === "authed") {
      const t = setTimeout(() => modal.close(), 400);
      return () => clearTimeout(t);
    }
  }, [modal, state.auth.status]);

  if (!modal.isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isAuthenticating) modal.close();
      }}
    >
      <div className="w-full max-w-md p-4">
        <div className="panel rounded-xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Connect wallet</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => modal.close()}
              disabled={isAuthenticating}
              aria-label="Close"
            >
              ✕
            </Button>
          </div>
          <p className="mt-1 text-xs text-[color:var(--color-fg-muted)]">
            DefiPilot never holds your keys. Connect and sign a free message.
          </p>
          <div className="mt-4">
            <ConnectWalletPanel variant="modal" onAuthed={() => modal.close()} />
          </div>
        </div>
      </div>
    </div>
  );
}

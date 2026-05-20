"use client";

import { useEffect } from "react";
import { Button, Pill } from "@/components/ui";
import { useApp } from "@/state/app-state";
import { ConnectWalletPanel } from "./connect-wallet-panel";

export function ConnectWalletStage() {
  const { state, dispatch } = useApp();

  // When user reaches "authed" on this stage, advance to survey.
  useEffect(() => {
    if (state.auth.status === "authed" && state.stage === "connect-wallet") {
      const t = setTimeout(
        () => dispatch({ type: "GOTO", stage: "survey" }),
        500,
      );
      return () => clearTimeout(t);
    }
  }, [state.auth.status, state.stage, dispatch]);

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-2xl flex-col items-center px-6 py-12">
      <Pill>Connect wallet</Pill>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Connect your wallet
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-[color:var(--color-fg-muted)]">
        DefiPilot uses your wallet to prove ownership and tailor recommendations.
        Connect once, then sign a free message. We never hold your keys.
      </p>

      <ConnectWalletPanel variant="page" />

      <Button
        variant="ghost"
        className="mt-4"
        onClick={() => dispatch({ type: "GOTO", stage: "landing" })}
      >
        Back
      </Button>
    </main>
  );
}

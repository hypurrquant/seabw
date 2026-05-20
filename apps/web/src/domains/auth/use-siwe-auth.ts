"use client";

import { useCallback, useEffect } from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { useApp } from "@/state/app-state";
import { getChallenge, verifySignature } from "@/lib/hq-api";

export interface UseSiweAuth {
  status: ReturnType<typeof useApp>["state"]["auth"]["status"];
  ownerAddress?: `0x${string}`;
  error?: string;
  authenticate: () => Promise<void>;
  signOut: () => void;
}

export function useSiweAuth(): UseSiweAuth {
  const { state, dispatch } = useApp();
  const { address, status: accountStatus } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();

  // Sync wagmi account → AppState auth
  useEffect(() => {
    if (accountStatus === "disconnected") {
      if (state.auth.status !== "idle") {
        console.info("[siwe] wallet disconnected → AUTH_RESET");
        dispatch({ type: "AUTH_RESET" });
      }
      return;
    }
    if (accountStatus === "connected" && address) {
      const known = state.auth.ownerAddress?.toLowerCase();
      const next = address.toLowerCase();
      if (known && known !== next) {
        console.info("[siwe] account switched → AUTH_RESET");
        dispatch({ type: "AUTH_RESET" });
        dispatch({ type: "AUTH_WALLET_CONNECTED", address });
      } else if (!known) {
        dispatch({ type: "AUTH_WALLET_CONNECTED", address });
      }
    }
  }, [accountStatus, address, state.auth.status, state.auth.ownerAddress, dispatch]);

  const authenticate = useCallback(async (): Promise<void> => {
    if (!address) {
      dispatch({ type: "AUTH_FAILED", error: "Wallet not connected" });
      return;
    }
    dispatch({ type: "AUTH_STARTED" });
    try {
      console.info("[siwe] challenge", address);
      const challenge = await getChallenge(address);
      console.info("[siwe] sign");
      const signature = await signMessageAsync({ message: challenge });
      console.info("[siwe] verify");
      const { token, expiresAt } = await verifySignature({
        address,
        challenge,
        signature,
      });
      console.info("[siwe] authed", { expiresAt });
      dispatch({
        type: "AUTH_VERIFIED",
        address,
        token,
        expiresAt,
      });
    } catch (err) {
      const code = classifyError(err);
      console.warn("[siwe] failure", code, err);
      dispatch({ type: "AUTH_FAILED", error: code });
    }
  }, [address, dispatch, signMessageAsync]);

  const signOut = useCallback((): void => {
    console.info("[siwe] sign out");
    try {
      disconnect();
    } catch (err) {
      console.warn("[siwe] disconnect error", err);
    }
    dispatch({ type: "AUTH_RESET" });
    dispatch({ type: "GOTO", stage: "landing" });
  }, [disconnect, dispatch]);

  return {
    status: state.auth.status,
    ownerAddress: state.auth.ownerAddress,
    error: state.auth.error,
    authenticate,
    signOut,
  };
}

function classifyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.toLowerCase().includes("rejected") ||
    msg.toLowerCase().includes("denied") ||
    msg.toLowerCase().includes("user rejected")
  ) {
    return "Signature rejected. Click Sign in to try again.";
  }
  if (msg.includes("401")) {
    return "Sign-in expired. Try again.";
  }
  if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("network")) {
    return "Could not reach DefiPilot server.";
  }
  if (msg.includes("HQ verify")) {
    return "Signature verification failed.";
  }
  return msg || "Sign-in failed.";
}

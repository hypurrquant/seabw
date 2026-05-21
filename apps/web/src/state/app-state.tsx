"use client";

import {
  createContext,
  Dispatch,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type { Answers, TierResult } from "@/domains/survey/lib";
import { clearAuth, loadAuth, saveAuth } from "@/lib/auth-storage";

export type Stage =
  | "landing"
  | "connect-wallet"
  | "survey"
  | "tier-result";

export type AuthStatus =
  | "idle"
  | "connected"
  | "authenticating"
  | "authed"
  | "error";

export interface AuthState {
  status: AuthStatus;
  ownerAddress?: `0x${string}`;
  token?: string;
  tokenExpiresAt?: number;
  error?: string;
}

export interface AppState {
  stage: Stage;
  answers?: Answers;
  tier?: TierResult;
  auth: AuthState;
  /** False until AppStateProvider mounts and the localStorage rehydrate effect runs. */
  rehydrated: boolean;
  lastError?: string;
}

type Action =
  | { type: "GOTO"; stage: Stage }
  | { type: "SET_ANSWERS"; answers: Answers }
  | { type: "SET_TIER"; tier: TierResult }
  | { type: "ERROR"; message: string }
  | { type: "RESET" }
  | { type: "AUTH_WALLET_CONNECTED"; address: `0x${string}` }
  | { type: "AUTH_STARTED" }
  | {
      type: "AUTH_VERIFIED";
      address: `0x${string}`;
      token: string;
      expiresAt: number;
    }
  | { type: "AUTH_FAILED"; error: string }
  | { type: "AUTH_RESET" }
  | { type: "REHYDRATED" };

const INITIAL: AppState = {
  stage: "landing",
  auth: { status: "idle" },
  rehydrated: false,
};

const PROTECTED_STAGES: ReadonlySet<Stage> = new Set([
  "survey",
  "tier-result",
]);

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "GOTO": {
      const requested = action.stage;
      const allowed =
        !PROTECTED_STAGES.has(requested) || state.auth.status === "authed";
      const next: Stage = allowed ? requested : "connect-wallet";
      return { ...state, stage: next, lastError: undefined };
    }
    case "SET_ANSWERS":
      return { ...state, answers: action.answers };
    case "SET_TIER":
      return { ...state, tier: action.tier, stage: "tier-result" };
    case "ERROR":
      return { ...state, lastError: action.message };
    case "RESET":
      return INITIAL;
    case "AUTH_WALLET_CONNECTED": {
      if (
        state.auth.ownerAddress?.toLowerCase() === action.address.toLowerCase()
      ) {
        return state;
      }
      return {
        ...state,
        auth: { status: "connected", ownerAddress: action.address },
      };
    }
    case "AUTH_STARTED":
      return {
        ...state,
        auth: { ...state.auth, status: "authenticating", error: undefined },
      };
    case "AUTH_VERIFIED":
      return {
        ...state,
        auth: {
          status: "authed",
          ownerAddress: action.address,
          token: action.token,
          tokenExpiresAt: action.expiresAt,
        },
      };
    case "AUTH_FAILED":
      return {
        ...state,
        auth: { ...state.auth, status: "error", error: action.error },
      };
    case "AUTH_RESET":
      return { ...state, auth: { status: "idle" } };
    case "REHYDRATED":
      return { ...state, rehydrated: true };
  }
}

const Ctx = createContext<{
  state: AppState;
  dispatch: Dispatch<Action>;
} | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const rehydratedRef = useRef(false);

  // Rehydrate SIWE token from localStorage once on mount.
  useEffect(() => {
    if (rehydratedRef.current) return;
    rehydratedRef.current = true;
    const stored = loadAuth();
    if (stored) {
      console.info("[app-state] rehydrating auth", {
        address: stored.address,
        expiresAt: stored.expiresAt,
      });
      dispatch({
        type: "AUTH_VERIFIED",
        address: stored.address,
        token: stored.token,
        expiresAt: stored.expiresAt,
      });
    } else {
      console.info("[app-state] no stored auth");
    }
    dispatch({ type: "REHYDRATED" });
  }, []);

  // Persist on authed, clear on idle/error. Gated on `rehydrated` so the
  // initial "idle" state never clears storage before rehydrate runs.
  useEffect(() => {
    if (!state.rehydrated) return;
    const auth = state.auth;
    if (
      auth.status === "authed" &&
      auth.ownerAddress &&
      auth.token &&
      auth.tokenExpiresAt
    ) {
      saveAuth({
        address: auth.ownerAddress,
        token: auth.token,
        expiresAt: auth.tokenExpiresAt,
      });
    } else if (auth.status === "idle" || auth.status === "error") {
      clearAuth();
    }
  }, [state.rehydrated, state.auth]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): { state: AppState; dispatch: Dispatch<Action> } {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppStateProvider");
  return ctx;
}

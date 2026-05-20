"use client";

import {
  createContext,
  Dispatch,
  ReactNode,
  useContext,
  useMemo,
  useReducer,
} from "react";
import type { Answers, TierResult } from "@/domains/survey/lib";

export type Stage =
  | "landing"
  | "survey"
  | "tier-result"
  | "connect-wallet"
  | "chat";

export interface AppState {
  stage: Stage;
  answers?: Answers;
  tier?: TierResult;
  lastError?: string;
}

type Action =
  | { type: "GOTO"; stage: Stage }
  | { type: "SET_ANSWERS"; answers: Answers }
  | { type: "SET_TIER"; tier: TierResult }
  | { type: "ERROR"; message: string }
  | { type: "RESET" };

const INITIAL: AppState = { stage: "landing" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "GOTO":
      return { ...state, stage: action.stage, lastError: undefined };
    case "SET_ANSWERS":
      return { ...state, answers: action.answers };
    case "SET_TIER":
      return { ...state, tier: action.tier, stage: "tier-result" };
    case "ERROR":
      return { ...state, lastError: action.message };
    case "RESET":
      return INITIAL;
  }
}

const Ctx = createContext<{
  state: AppState;
  dispatch: Dispatch<Action>;
} | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): { state: AppState; dispatch: Dispatch<Action> } {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppStateProvider");
  return ctx;
}

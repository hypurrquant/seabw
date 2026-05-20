"use client";

import {
  createContext,
  Dispatch,
  ReactNode,
  useContext,
  useMemo,
  useReducer,
} from "react";
import type {
  Answers,
  ExecutionResult,
  PipelinePlan,
  TierResult,
} from "@seabw/core";

export type Stage =
  | "landing"
  | "survey"
  | "tier-result"
  | "mode-choice"
  | "connect-wallet"
  | "intent"
  | "marketplace"
  | "basket-review"
  | "plan-review"
  | "execution"
  | "portfolio";

export type Mode = "robo" | "marketplace";

export interface BasketLine {
  productId: string;
  amountUsd: number;
  diversifyAcross?: number;   // A — 1..3
  splitRanges?: boolean;      // B — V3 only
}

export interface AppState {
  stage: Stage;
  mode?: Mode;
  answers?: Answers;
  tier?: TierResult;
  plan?: PipelinePlan;
  execution?: ExecutionResult;
  basket: BasketLine[];
  totalDepositUsd: number;
  lastError?: string;
}

type Action =
  | { type: "GOTO"; stage: Stage }
  | { type: "SET_MODE"; mode: Mode }
  | { type: "SET_ANSWERS"; answers: Answers }
  | { type: "SET_TIER"; tier: TierResult }
  | { type: "SET_PLAN"; plan: PipelinePlan }
  | { type: "SET_EXECUTION"; execution: ExecutionResult }
  | { type: "BASKET_ADD"; productId: string; amountUsd: number }
  | { type: "BASKET_REMOVE"; productId: string }
  | { type: "BASKET_SET_AMOUNT"; productId: string; amountUsd: number }
  | { type: "BASKET_SET_DIVERSIFY"; productId: string; diversifyAcross: number }
  | { type: "BASKET_SET_SPLIT_RANGES"; productId: string; splitRanges: boolean }
  | { type: "BASKET_CLEAR" }
  | { type: "SET_TOTAL_DEPOSIT"; usd: number }
  | { type: "ERROR"; message: string }
  | { type: "RESET" };

const INITIAL: AppState = { stage: "landing", basket: [], totalDepositUsd: 3000 };

function setBasketAmount(state: AppState, productId: string, amountUsd: number): AppState {
  const existing = state.basket.find((b) => b.productId === productId);
  if (existing) {
    return {
      ...state,
      basket: state.basket.map((b) =>
        b.productId === productId ? { ...b, amountUsd } : b,
      ),
    };
  }
  return { ...state, basket: [...state.basket, { productId, amountUsd }] };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "GOTO":
      return { ...state, stage: action.stage, lastError: undefined };
    case "SET_MODE":
      return { ...state, mode: action.mode };
    case "SET_ANSWERS":
      return { ...state, answers: action.answers };
    case "SET_TIER":
      return { ...state, tier: action.tier, stage: "tier-result" };
    case "SET_PLAN":
      return { ...state, plan: action.plan, stage: "plan-review", lastError: undefined };
    case "SET_EXECUTION":
      return { ...state, execution: action.execution };
    case "BASKET_ADD":
      return setBasketAmount(state, action.productId, action.amountUsd);
    case "BASKET_REMOVE":
      return { ...state, basket: state.basket.filter((b) => b.productId !== action.productId) };
    case "BASKET_SET_AMOUNT":
      return setBasketAmount(state, action.productId, action.amountUsd);
    case "BASKET_SET_DIVERSIFY":
      return {
        ...state,
        basket: state.basket.map((b) =>
          b.productId === action.productId
            ? { ...b, diversifyAcross: action.diversifyAcross }
            : b,
        ),
      };
    case "BASKET_SET_SPLIT_RANGES":
      return {
        ...state,
        basket: state.basket.map((b) =>
          b.productId === action.productId
            ? { ...b, splitRanges: action.splitRanges }
            : b,
        ),
      };
    case "BASKET_CLEAR":
      return { ...state, basket: [] };
    case "SET_TOTAL_DEPOSIT":
      return { ...state, totalDepositUsd: action.usd };
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

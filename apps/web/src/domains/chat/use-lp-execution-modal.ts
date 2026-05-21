"use client";

import { create } from "zustand";
import type { LpCard } from "@/domains/agent/tools/propose-lp-positions";

type State = {
  card: LpCard | null;
  isOpen: boolean;
  open: (card: LpCard) => void;
  close: () => void;
};

export const useLpExecutionModal = create<State>((set) => ({
  card: null,
  isOpen: false,
  open: (card) => set({ card, isOpen: true }),
  close: () => set({ card: null, isOpen: false }),
}));

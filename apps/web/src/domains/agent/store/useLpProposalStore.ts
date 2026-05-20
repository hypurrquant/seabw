import { create } from "zustand";
import type { LpProposal } from "../tools/propose-lp-positions";

interface LpProposalStore {
  current: LpProposal | null;
  push: (proposal: LpProposal) => void;
  clear: () => void;
}

export const useLpProposalStore = create<LpProposalStore>((set) => ({
  current: null,
  push: (proposal) => set({ current: proposal }),
  clear: () => set({ current: null }),
}));

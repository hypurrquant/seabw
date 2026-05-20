"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

interface WalletModal {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const Ctx = createContext<WalletModal | null>(null);

export function WalletModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWalletModal(): WalletModal {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWalletModal must be used inside WalletModalProvider");
  return v;
}

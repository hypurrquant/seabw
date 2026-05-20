"use client";

import { createContext, ReactNode, useContext, useMemo } from "react";
import { useApp } from "@/state/app-state";
import { createHqClient, type HqClient } from "@/lib/hq-api";

const Ctx = createContext<HqClient | null>(null);

export function HqClientProvider({ children }: { children: ReactNode }) {
  const { state } = useApp();
  const client = useMemo(() => {
    const token = state.auth.token ?? null;
    const expiresAt = state.auth.tokenExpiresAt ?? 0;
    return createHqClient({
      getToken: () => {
        if (!token) return null;
        if (Date.now() >= expiresAt - 5000) return null;
        return token;
      },
    });
  }, [state.auth.token, state.auth.tokenExpiresAt]);

  return <Ctx.Provider value={client}>{children}</Ctx.Provider>;
}

export function useHqClient(): HqClient {
  const c = useContext(Ctx);
  if (!c) throw new Error("useHqClient must be used inside HqClientProvider");
  return c;
}

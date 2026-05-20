"use client";

import { ReactNode, useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getWagmiConfig } from "@/lib/wagmi";
import { AppStateProvider } from "@/state/app-state";
import { HqClientProvider } from "@/domains/auth/hq-client-provider";
import { HqBootProvider } from "@/domains/agent/providers/HqBootProvider";
import { AgentRuntimeProvider } from "@/domains/agent/providers/AgentRuntimeProvider";
import { WalletModalProvider } from "@/domains/wallet/wallet-modal-context";
import { ConnectWalletModal } from "@/domains/wallet/connect-wallet-modal";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <QueryClientProvider client={queryClient}>
        <AppStateProvider>{children}</AppStateProvider>
      </QueryClientProvider>
    );
  }
  return (
    <WagmiProvider config={getWagmiConfig()}>
      <QueryClientProvider client={queryClient}>
        <AppStateProvider>
          <HqClientProvider>
            <HqBootProvider>
              <AgentRuntimeProvider>
                <WalletModalProvider>
                  {children}
                  <ConnectWalletModal />
                </WalletModalProvider>
              </AgentRuntimeProvider>
            </HqBootProvider>
          </HqClientProvider>
        </AppStateProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

"use client";

import { ReactNode, useEffect, useMemo, useRef } from "react";
import { initAgentDeps, useAgentStore } from "@hq/react/agent";
import { useApp } from "@/state/app-state";
import { ServerProxyProvider } from "./ServerProxyProvider";
import { createBrowserToolRegistry } from "../tools";
import { createProposeLpPositionsHandler } from "../tools/propose-lp-positions";
import { useLpProposalStore } from "../store/useLpProposalStore";
import { buildRegistryDeps } from "../runtime/registry-deps";
import { getPairAvailableUsd } from "../runtime/pair-available-usd";
import { InMemoryChatHistoryAdapter } from "../runtime/in-memory-chat-history";

let __hqAgentInitialized = false;

const HQ_ORIGIN = process.env.NEXT_PUBLIC_HQ_ORIGIN ?? "http://localhost:3003";

export function AgentRuntimeProvider({ children }: { children: ReactNode }) {
  const { state } = useApp();
  const token = state.auth.status === "authed" ? state.auth.token ?? null : null;
  const expiresAt = state.auth.status === "authed" ? state.auth.tokenExpiresAt ?? null : null;

  const tokenRef = useRef("");
  tokenRef.current = token ?? "";

  const registry = useMemo(
    () => createBrowserToolRegistry(buildRegistryDeps(() => tokenRef.current)),
    [],
  );

  useEffect(() => {
    if (__hqAgentInitialized) return;
    __hqAgentInitialized = true;

    registry.register(
      "propose_lp_positions",
      createProposeLpPositionsHandler({
        pushProposal: (proposal) => useLpProposalStore.getState().push(proposal),
        getPairAvailableUsd,
      }),
    );

    initAgentDeps({
      provider: new ServerProxyProvider(),
      toolRegistry: registry,
      chatHistory: new InMemoryChatHistoryAdapter(),
      apiBase: HQ_ORIGIN,
    });
  }, [registry]);

  useEffect(() => {
    useAgentStore.setState({ auth: { token, expiresAt } });
  }, [token, expiresAt]);

  return <>{children}</>;
}

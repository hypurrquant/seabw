"use client";

import { useApp } from "@/state/app-state";
import { Landing } from "@/domains/landing/landing";
import { Survey } from "@/domains/survey/survey";
import { TierResultView } from "@/domains/survey/tier-result";
import { ConnectWalletStage } from "@/domains/wallet/connect-wallet-stage";
import { Chat } from "@/domains/chat/chat";

function Router() {
  const { state } = useApp();
  switch (state.stage) {
    case "landing":
      return <Landing />;
    case "connect-wallet":
      return <ConnectWalletStage />;
    case "survey":
      return <Survey />;
    case "tier-result":
      return <TierResultView />;
    case "chat":
      return (
        <div className="grid min-h-[calc(100dvh-2.5rem)] grid-cols-1 lg:grid-cols-2">
          <aside className="overflow-y-auto border-b lg:border-b-0 lg:border-r border-[color:var(--color-border)]">
            <TierResultView readOnly />
          </aside>
          <section className="flex h-full flex-col overflow-hidden">
            <Chat />
          </section>
        </div>
      );
    default:
      return <Landing />;
  }
}

export default function HomePage() {
  return <Router />;
}

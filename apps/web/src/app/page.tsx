"use client";

import { useApp } from "@/state/app-state";
import { Landing } from "@/domains/landing/landing";
import { Survey } from "@/domains/survey/survey";
import { TierResultView } from "@/domains/survey/tier-result";
import { ConnectWalletStage } from "@/domains/wallet/connect-wallet-stage";

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
    default:
      return <Landing />;
  }
}

export default function HomePage() {
  return <Router />;
}

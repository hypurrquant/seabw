"use client";

import { AppStateProvider, useApp } from "@/state/app-state";
import { Landing } from "@/components/landing";
import { Survey } from "@/components/survey";
import { TierResultView } from "@/components/tier-result";
import { ConnectWallet } from "@/components/connect-wallet";
import { IntentInput } from "@/components/intent-input";
import { PlanReview } from "@/components/plan-review";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { Marketplace } from "@/components/marketplace";
import { BasketReview } from "@/components/basket-review";
import { StageIndicator } from "@/components/stage-indicator";

function Router() {
  const { state } = useApp();
  switch (state.stage) {
    case "landing":
      return <Landing />;
    case "survey":
      return <Survey />;
    case "tier-result":
      return <TierResultView />;
    case "connect-wallet":
      return <ConnectWallet />;
    case "intent":
      return <IntentInput />;
    case "marketplace":
      return <Marketplace />;
    case "basket-review":
      return <BasketReview />;
    case "plan-review":
      return <PlanReview />;
    case "execution":
    case "portfolio":
      return <PortfolioSummary />;
    default:
      return <Landing />;
  }
}

export default function HomePage() {
  return (
    <AppStateProvider>
      <StageIndicator />
      <Router />
    </AppStateProvider>
  );
}

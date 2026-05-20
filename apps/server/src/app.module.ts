import { Module } from "@nestjs/common";
import { PlanModule } from "./domains/plan/plan.module";
import { MarketplaceModule } from "./domains/marketplace/marketplace.module";
import { PrecheckModule } from "./domains/precheck/precheck.module";
import { PortfolioModule } from "./domains/portfolio/portfolio.module";
import { AgentModule } from "./domains/agent/agent.module";

@Module({
  imports: [PlanModule, MarketplaceModule, PrecheckModule, PortfolioModule, AgentModule],
})
export class AppModule {}

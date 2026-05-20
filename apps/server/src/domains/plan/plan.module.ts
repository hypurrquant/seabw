import { Module } from "@nestjs/common";
import { PlanController } from "./plan.controller";
import { PlanService } from "./plan.service";
import { AgentModule } from "../agent/agent.module";

@Module({
  imports: [AgentModule],
  controllers: [PlanController],
  providers: [PlanService],
  exports: [PlanService],
})
export class PlanModule {}

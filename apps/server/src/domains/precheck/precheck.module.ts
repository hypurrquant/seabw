import { Module } from "@nestjs/common";
import { PrecheckController } from "./precheck.controller";
import { PrecheckService } from "./precheck.service";

@Module({
  controllers: [PrecheckController],
  providers: [PrecheckService],
})
export class PrecheckModule {}

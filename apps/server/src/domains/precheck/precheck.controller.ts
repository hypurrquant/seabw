import { Body, Controller, Post, Res, UsePipes } from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import type { PrecheckRequest } from "@seabw/core";
import { PrecheckService } from "./precheck.service";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

const PrecheckSchema = z.object({
  planId: z.string().min(1),
  stepId: z.string().min(1),
  signerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/) as unknown as z.ZodType<`0x${string}`>,
});

@Controller("/api/precheck")
export class PrecheckController {
  constructor(private readonly precheck: PrecheckService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(PrecheckSchema))
  async run(@Body() body: PrecheckRequest, @Res() res: Response): Promise<void> {
    const result = await this.precheck.run(body.planId, body.stepId, body.signerAddress);
    res.status(result.status).json(result.body);
  }
}

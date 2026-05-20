import {
  Body,
  Controller,
  HttpException,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UsePipes,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  PlanRequestSchema,
  type PlanRehydrateRequest,
  type PlanRehydrateResponse,
  type PlanRequest,
  type PlanResponse,
} from "@seabw/core";
import { z } from "zod";
import { PlanService } from "./plan.service";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { clientIp } from "../../common/req-context";
import { rateLimit } from "../../lib/ratelimit";

const RehydrateSchema = z.object({
  planId: z.string().min(1),
  signerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/) as unknown as z.ZodType<`0x${string}`>,
});

@Controller("/api/plan")
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(PlanRequestSchema, { errorMessage: "Invalid plan request" }))
  async create(
    @Body() body: PlanRequest,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<PlanResponse | void> {
    const ip = clientIp(req);
    const rate = rateLimit(`plan:${ip}`, 10, 60_000);
    if (!rate.allowed) {
      res
        .setHeader("retry-after", Math.ceil(rate.retryAfterMs / 1000).toString())
        .status(429)
        .json({ error: "Too many plan requests. Please wait." });
      return;
    }
    if (process.env.DEFIPILOT_DISABLE_EXEC === "true") {
      throw new ServiceUnavailableException({
        error: "Execution is disabled by the operator. Try again later.",
      });
    }
    const result = await this.planService.composeForRequest(body, ip);
    res.status(result.status).json(result.body);
  }

  @Post("rehydrate")
  @UsePipes(new ZodValidationPipe(RehydrateSchema, { errorMessage: "Invalid rehydrate payload" }))
  async rehydrate(
    @Body() body: PlanRehydrateRequest,
    @Res() res: Response,
  ): Promise<PlanRehydrateResponse | void> {
    if (process.env.DEFIPILOT_DISABLE_EXEC === "true") {
      throw new ServiceUnavailableException({ error: "Execution disabled" });
    }
    const result = await this.planService.rehydrate(body.planId, body.signerAddress);
    res.status(result.status).json(result.body);
  }
}

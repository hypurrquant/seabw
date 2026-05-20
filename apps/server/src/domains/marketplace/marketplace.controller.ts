import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UsePipes,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  AnswerScoreSchema,
  TierSchema,
  type MarketplacePlanRequest,
  type MarketplaceYieldsResponse,
  type Tier,
} from "@seabw/core";
import { MarketplaceService } from "./marketplace.service";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { clientIp } from "../../common/req-context";
import { rateLimit } from "../../lib/ratelimit";

const HexAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/) as unknown as z.ZodType<`0x${string}`>;

const BasketPlanSchema = z.object({
  tier: TierSchema,
  rawScore: z.number().int().min(5).max(32),
  literacyScore: AnswerScoreSchema,
  derivativeExpScore: AnswerScoreSchema,
  vulnerableConsumer: z.boolean(),
  basket: z
    .array(
      z.object({
        productId: z.string().min(1),
        amountUsd: z.number().nonnegative().max(1_000_000),
        diversifyAcross: z.number().int().min(1).max(3).optional(),
        splitRanges: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(8),
  wallet: z.object({
    address: HexAddress,
    chainId: z.number().int().positive(),
    gasBalanceWei: z.string(),
  }),
});

@Controller("/api/marketplace")
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get("yields")
  async listYields(
    @Req() req: Request,
    @Query("tier") tierQuery: string | undefined,
  ): Promise<MarketplaceYieldsResponse> {
    const rate = rateLimit(`yields:${clientIp(req)}`, 30, 60_000);
    if (!rate.allowed) {
      throw new HttpException({ error: "Too many requests" }, 429);
    }
    const parsed = TierSchema.safeParse(tierQuery);
    if (!parsed.success) {
      throw new BadRequestException({ error: "Missing or invalid tier" });
    }
    const tier: Tier = parsed.data;
    return await this.marketplace.listYields(tier);
  }

  @Post("plan")
  @UsePipes(new ZodValidationPipe(BasketPlanSchema))
  async composePlan(
    @Body() body: MarketplacePlanRequest,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const ip = clientIp(req);
    const rate = rateLimit(`basket-plan:${ip}`, 10, 60_000);
    if (!rate.allowed) {
      throw new HttpException({ error: "Too many plan requests" }, 429);
    }
    if (process.env.DEFIPILOT_DISABLE_EXEC === "true") {
      throw new ServiceUnavailableException({ error: "Execution disabled" });
    }
    const result = await this.marketplace.composeBasket(body, ip);
    res.status(result.status).json(result.body);
  }
}

import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { DEFI_CLI_CHAIN_IDS, isDefiCliChain } from "@seabw/core";
import { PortfolioService } from "./portfolio.service";
import { clientIp } from "../../common/req-context";
import { rateLimit } from "../../lib/ratelimit";

const QuerySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) as unknown as z.ZodType<`0x${string}`>,
  chainId: z.coerce.number().int().positive(),
});

@Controller("/api/portfolio")
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get("health")
  async health(
    @Req() req: Request,
    @Query() query: { address?: string; chainId?: string },
  ): Promise<{ health: unknown }> {
    const rate = rateLimit(`portfolio:${clientIp(req)}`, 20, 60_000);
    if (!rate.allowed) {
      throw new HttpException({ error: "Too many requests" }, 429);
    }
    const parsed = QuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        error: "Invalid address or chainId",
        issues: parsed.error.flatten(),
      });
    }
    const { address, chainId } = parsed.data;
    if (!isDefiCliChain(chainId)) {
      throw new BadRequestException({
        error: `Chain ${chainId} not supported. Use one of: ${[...DEFI_CLI_CHAIN_IDS].join(", ")}`,
      });
    }
    try {
      const health = await this.portfolio.health(address, chainId);
      return { health };
    } catch (err) {
      throw new HttpException(
        {
          error: "Failed to read portfolio: " + ((err as Error).message ?? "unknown").split("\n")[0],
        },
        502,
      );
    }
  }
}

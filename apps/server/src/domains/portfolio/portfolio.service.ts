import { Injectable } from "@nestjs/common";
import { CHAINS } from "@seabw/core";
import { lpPositions, portfolioShow } from "../../lib/defi-cli";
import { classifyPortfolio, type PortfolioHealth } from "./internal/risk";

@Injectable()
export class PortfolioService {
  async health(address: `0x${string}`, chainId: number): Promise<PortfolioHealth> {
    const [show, lps] = await Promise.all([
      portfolioShow(chainId, address),
      lpPositions(chainId, address),
    ]);
    return classifyPortfolio(show, lps, chainId, CHAINS[chainId]?.name ?? `Chain ${chainId}`);
  }
}

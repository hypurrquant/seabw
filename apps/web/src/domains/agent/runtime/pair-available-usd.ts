import { formatUnits } from "viem";
import { getAccount } from "wagmi/actions";
import { useTokenConfigStore } from "@hq/react/token";
import { useTokenPriceStore } from "@hq/react/price/store/useTokenPriceStore";
import { useTokenBalanceStore, getBalanceSlice } from "@hq/react/balance";
import { getWagmiConfig } from "@/lib/wagmi";

/**
 * Returns sum of (token0 valueUsd + token1 valueUsd) currently held by the
 * connected wallet on `chainId`. Returns null when wallet is not connected or
 * token config/price stores haven't hydrated yet — callers should treat null
 * as "skip validation" rather than zero.
 */
export function getPairAvailableUsd(
  chainId: number,
  token0Address: string,
  token1Address: string,
): number | null {
  const account = getAccount(getWagmiConfig());
  if (!account.address) return null;
  const owner = account.address;

  const configTokens = useTokenConfigStore.getState().tokens;
  if (configTokens.length === 0) return null;

  const t0Addr = token0Address.toLowerCase();
  const t1Addr = token1Address.toLowerCase();
  const t0 = configTokens.find(
    (t) => t.chainId === chainId && t.address.toLowerCase() === t0Addr,
  );
  const t1 = configTokens.find(
    (t) => t.chainId === chainId && t.address.toLowerCase() === t1Addr,
  );
  if (!t0 || !t1) return null;

  const balCache = useTokenBalanceStore.getState().cache;
  const balSlice = getBalanceSlice(balCache, owner, chainId);

  const priceCache = useTokenPriceStore.getState().cache;
  const chainPrices = priceCache[String(chainId)];
  if (!chainPrices) return null;

  function usdFor(token: { address: `0x${string}`; decimals: number }): number {
    const raw = balSlice[token.address.toLowerCase()] ?? 0n;
    if (raw === 0n) return 0;
    const num = Number(formatUnits(raw, token.decimals));
    const price = chainPrices?.[token.address.toLowerCase()];
    if (price == null) return 0;
    return num * price;
  }

  return usdFor(t0) + usdFor(t1);
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { Button, Card, Pill } from "@/components/ui";
import { useApp } from "@/state/app-state";
import type { YieldProduct } from "@/types/yield-product";
import { chainName, DEFAULT_CHAIN_ID } from "@/config/chains";
import { formatPct, formatUsd } from "@/lib/utils";

export function BasketReview() {
  const { state, dispatch } = useApp();
  const tier = state.tier?.tier ?? "balanced";
  const { address, chainId } = useAccount();
  const balance = useBalance({ address });
  const [products, setProducts] = useState<YieldProduct[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch(`/api/marketplace/yields?tier=${tier}`)
      .then((r) => r.json())
      .then((d: { products?: YieldProduct[] }) => {
        if (!cancel) setProducts(d.products ?? []);
      });
    return () => { cancel = true; };
  }, [tier]);

  const byId = useMemo(() => {
    const m = new Map<string, YieldProduct>();
    for (const p of products ?? []) m.set(p.id, p);
    return m;
  }, [products]);

  const items = state.basket
    .map((b) => ({ basket: b, product: byId.get(b.productId) }))
    .filter((x): x is { basket: typeof state.basket[number]; product: YieldProduct } => Boolean(x.product));

  const totalUsd = items.reduce((acc, x) => acc + x.basket.amountUsd, 0);
  const weightedApr = totalUsd > 0
    ? items.reduce((acc, x) => acc + (x.product.apr.totalPct * x.basket.amountUsd), 0) / totalUsd
    : 0;
  const allRisks = Array.from(new Set(items.flatMap((x) => x.product.risks)));
  const chainsTouched = Array.from(new Set(items.map((x) => x.product.chainId)));

  const setAmount = (productId: string, amountUsd: number) => {
    dispatch({ type: "BASKET_SET_AMOUNT", productId, amountUsd: Math.max(0, Math.round(amountUsd)) });
  };

  const distributeEvenly = () => {
    if (items.length === 0) return;
    const per = Math.round(state.totalDepositUsd / items.length);
    for (const x of items) setAmount(x.basket.productId, per);
  };

  const checkout = async () => {
    if (items.length === 0) {
      setError("Basket is empty.");
      return;
    }
    setSubmitting(true);
    setError(null);
    // Wallet is optional at plan-build time. Composer hydrates calldata
    // against a burn placeholder so the user can review APR + tx breakdown;
    // sign-time prompts wallet connect + re-hydrates with the real address.
    const PREVIEW_ADDRESS = "0x000000000000000000000000000000000000dEaD" as const;
    try {
      const res = await fetch("/api/marketplace/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tier,
          rawScore: state.tier?.rawScore ?? 20,
          literacyScore: state.answers?.literacy ?? 2,
          derivativeExpScore: state.answers?.derivativeExp ?? 1,
          vulnerableConsumer:
            (state.answers?.ageBucket ?? "under65") === "over65" ||
            (state.answers?.firstTimeDefiPilot ?? false),
          basket: items.map((x) => ({
            productId: x.basket.productId,
            amountUsd: x.basket.amountUsd,
            diversifyAcross: x.basket.diversifyAcross,
            splitRanges: x.basket.splitRanges,
          })),
          wallet: {
            address: address ?? PREVIEW_ADDRESS,
            chainId: chainId ?? DEFAULT_CHAIN_ID,
            gasBalanceWei: balance.data?.value.toString() ?? "0",
          },
        }),
      });
      const data = (await res.json()) as { plan?: import("@/types").PipelinePlan; error?: string };
      if (!res.ok || !data.plan) {
        setError(data.error ?? `Server returned ${res.status}`);
        return;
      }
      dispatch({ type: "SET_PLAN", plan: data.plan });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-5xl flex-col px-6 py-8">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Pill>Basket · {tier}</Pill>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Allocate &amp; checkout</h1>
          <p className="text-sm text-[color:var(--color-fg-muted)]">
            Slide $ across positions, then build the plan. Guardrails still run on the basket.
          </p>
        </div>
        <Button variant="ghost" className="flex-none self-start" onClick={() => dispatch({ type: "GOTO", stage: "marketplace" })}>
          ← Back to marketplace
        </Button>
      </header>

      <Card title="Total deposit" description="Sliders cap at this amount. Adjust to resize the basket.">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={100}
            max={50_000}
            step={100}
            value={state.totalDepositUsd}
            onChange={(e) => dispatch({ type: "SET_TOTAL_DEPOSIT", usd: Number(e.target.value) })}
            className="w-full"
          />
          <span className="w-28 text-right text-sm">{formatUsd(state.totalDepositUsd)}</span>
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={distributeEvenly}>
            Distribute evenly
          </Button>
        </div>
      </Card>

      <Card title={`${items.length} positions in basket`} className="mt-4">
        {items.length === 0 && (
          <p className="text-sm text-[color:var(--color-fg-muted)]">
            Basket is empty. Go back to the marketplace and click Add.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {items.map(({ basket, product }) => (
            <li key={basket.productId} className="panel-2 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">
                    {product.protocolName} · {product.poolLabel}
                  </div>
                  <div className="text-[10px] text-[color:var(--color-fg-muted)]">
                    {chainName(product.chainId)} · {formatPct(product.apr.totalPct, 1)} APR · TVL {formatUsd(product.tvlUsd)}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "BASKET_REMOVE", productId: basket.productId })}>
                  Remove
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={state.totalDepositUsd}
                  step={50}
                  value={Math.min(basket.amountUsd, state.totalDepositUsd)}
                  onChange={(e) => setAmount(basket.productId, Number(e.target.value))}
                  className="flex-1"
                />
                <input
                  type="number"
                  min={0}
                  max={state.totalDepositUsd}
                  value={basket.amountUsd}
                  onChange={(e) => setAmount(basket.productId, Number(e.target.value))}
                  className="panel w-24 rounded-md px-2 py-1 text-right text-sm"
                />
                <span className="w-14 text-right text-xs text-[color:var(--color-fg-muted)]">
                  {totalUsd > 0 ? `${Math.round((basket.amountUsd / totalUsd) * 100)}%` : "—"}
                </span>
              </div>

              {(product.kind === "lp" || product.kind === "farm" || product.kind === "vault") && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-2">
                    <span className="text-[color:var(--color-fg-muted)]">Diversify across</span>
                    <select
                      value={basket.diversifyAcross ?? 1}
                      onChange={(e) =>
                        dispatch({
                          type: "BASKET_SET_DIVERSIFY",
                          productId: basket.productId,
                          diversifyAcross: Number(e.target.value),
                        })
                      }
                      className="panel-2 rounded-md px-2 py-1 text-xs"
                    >
                      <option value={1}>1 pool (this one)</option>
                      <option value={2}>2 similar pools</option>
                      <option value={3}>3 similar pools</option>
                    </select>
                  </label>
                  {(product.kind === "lp" || product.kind === "farm") && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={basket.splitRanges ?? false}
                        onChange={(e) =>
                          dispatch({
                            type: "BASKET_SET_SPLIT_RANGES",
                            productId: basket.productId,
                            splitRanges: e.target.checked,
                          })
                        }
                        disabled={
                          !["uniswap_v3", "algebra_v3"].includes(product.iface)
                        }
                      />
                      <span
                        className={
                          ["uniswap_v3", "algebra_v3"].includes(product.iface)
                            ? "text-[color:var(--color-fg-muted)]"
                            : "text-[color:var(--color-fg-muted)]/40 line-through"
                        }
                      >
                        Split into 3 ranges (tight / medium / wide){" "}
                        {!["uniswap_v3", "algebra_v3"].includes(product.iface) && "— V3 only"}
                      </span>
                    </label>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Aggregate" className="mt-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Total allocated" value={formatUsd(totalUsd)} />
          <Metric label="Weighted APR (est.)" value={formatPct(weightedApr, 1)} />
          <Metric label="Chains touched" value={chainsTouched.map(chainName).join(", ") || "—"} />
          <Metric label="Risk flags" value={allRisks.join(", ") || "none"} />
        </div>
        {totalUsd > state.totalDepositUsd && (
          <div className="panel-2 border-[color:var(--color-danger)]/40 text-xs text-[color:var(--color-danger)] p-2">
            Allocations sum to more than your total deposit. Reduce one of the sliders before checkout.
          </div>
        )}
      </Card>

      {error && (
        <div className="panel-2 border-[color:var(--color-danger)]/40 text-sm text-[color:var(--color-danger)] p-3 mt-4">
          {error}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => dispatch({ type: "GOTO", stage: "marketplace" })}>
          Keep shopping
        </Button>
        <Button
          onClick={checkout}
          disabled={submitting || items.length === 0 || totalUsd <= 0 || totalUsd > state.totalDepositUsd}
        >
          {submitting ? "Building plan…" : "Build plan from basket →"}
        </Button>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-2 p-3">
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)]">
        {label}
      </div>
      <div className="mt-1 text-base">{value}</div>
    </div>
  );
}

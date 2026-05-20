"use client";

import { useEffect, useMemo } from "react";
import type { YieldProduct } from "@seabw/core";
import { Button, Card, Pill } from "@/components/ui";
import { chainName } from "@seabw/core";
import { formatPct, formatUsd } from "@/lib/utils";
import { useApp } from "@/state/app-state";

interface Props {
  product: YieldProduct;
  onClose: () => void;
  inBasket: boolean;
}

// Generate a tiny APR sparkline path deterministically from variance.
function sparklinePath(seedBase: number, variancePct: number, points = 24): string {
  const w = 200;
  const h = 36;
  const step = w / (points - 1);
  let s = "";
  const seed = seedBase || 1;
  for (let i = 0; i < points; i++) {
    const noise = Math.sin(seed * (i + 1) * 0.42) * (variancePct / 100);
    const y = h / 2 - noise * h * 0.35;
    s += (i === 0 ? "M" : "L") + (i * step).toFixed(1) + "," + y.toFixed(1) + " ";
  }
  return s.trim();
}

export function ProductDetail({ product, onClose, inBasket }: Props) {
  const { dispatch, state } = useApp();
  const seed = useMemo(
    () =>
      product.id
        .split("")
        .reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) % 2147483647, 7),
    [product.id],
  );
  const variancePct = (product.apr.varianceBps ?? 200) / 100;
  const path = sparklinePath(seed, variancePct);
  const emissionRemainingDays = product.apr.emissionExpiresAt
    ? Math.max(
        0,
        Math.round(
          (new Date(product.apr.emissionExpiresAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleAdd = () => {
    const slotAmount =
      state.basket.length === 0
        ? state.totalDepositUsd
        : state.totalDepositUsd / (state.basket.length + 1);
    dispatch({ type: "BASKET_ADD", productId: product.id, amountUsd: Math.round(slotAmount) });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[color:var(--color-fg)]/20 backdrop-blur-sm p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto">
        <Card className="w-full" title={`${product.protocolName} · ${product.poolLabel}`}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Pill>{chainName(product.chainId)}</Pill>
            <Pill>{product.kind}</Pill>
            {product.risks.map((r) => (
              <Pill key={r} tone="warn">{r}</Pill>
            ))}
            {product.auditCount === 0 && <Pill tone="danger">no named audit</Pill>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Metric label="Total APR (est.)" value={formatPct(product.apr.totalPct, 1)} />
            <Metric label="TVL" value={formatUsd(product.tvlUsd)} />
            <Metric label="Audits" value={`${product.auditCount}`} />
            <Metric label="Age" value={`${product.ageDays}d`} />
          </div>

          <div className="panel-2 p-3">
            <div className="text-xs uppercase tracking-wider text-[color:var(--color-fg-muted)]">
              APR breakdown
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <Row label="Base (protocol rate)" value={formatPct(product.apr.basePct, 1)} />
              <Row label="Rewards (emissions)" value={formatPct(product.apr.rewardPct, 1)} />
            </div>
            {product.apr.rewardPct > 0 && (
              <p className="mt-2 text-[10px] text-[color:var(--color-warning)]">
                Reward portion is emission-driven. {emissionRemainingDays !== null && `~${emissionRemainingDays}d remaining`}
                {" "}before the program needs to be re-voted; APR can drop sharply.
              </p>
            )}
            <div className="mt-3">
              <div className="text-[10px] text-[color:var(--color-fg-muted)]">
                7d APR variance ribbon (±{variancePct.toFixed(1)}% indicative)
              </div>
              <svg width="200" height="36" className="block mt-1">
                <path d={path} stroke="var(--color-accent)" strokeWidth={1.5} fill="none" />
              </svg>
            </div>
          </div>

          <div className="panel-2 p-3 text-xs">
            <div className="text-[color:var(--color-fg-muted)] uppercase tracking-wider text-[10px]">
              Audits
            </div>
            <div className="mt-1">
              {product.audits.length === 0 ? "No named audit on record." : product.audits.join(" · ")}
            </div>
          </div>

          <div className="panel-2 p-3 text-xs">
            <div className="text-[color:var(--color-fg-muted)] uppercase tracking-wider text-[10px]">
              Inputs / Outputs
            </div>
            <div className="mt-1">
              Deposit: {product.inputs.join(" + ")} → Receive: {product.outputs.join(" + ")}
            </div>
            <div className="text-[10px] text-[color:var(--color-fg-muted)]">
              Lockup: {product.lockupDays === 0 ? "liquid" : `${product.lockupDays}d`} ·
              Min deposit: ${product.minDepositUsd ?? 0}
            </div>
          </div>

          <p className="text-[10px] text-[color:var(--color-fg-muted)]">
            APR is estimated from protocol data and emission schedules. Past emissions
            do not predict future emissions. DefiPilot does not guarantee yield.
          </p>

          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            {inBasket ? (
              <Button variant="danger" onClick={() => { dispatch({ type: "BASKET_REMOVE", productId: product.id }); onClose(); }}>
                Remove from basket
              </Button>
            ) : (
              <Button onClick={handleAdd}>Add to basket</Button>
            )}
          </div>
        </Card>
      </div>
    </div>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[color:var(--color-fg-muted)]">{label}</span>
      <span>{value}</span>
    </div>
  );
}

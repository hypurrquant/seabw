"use client";

import type { EnrichedPosition } from "@hq/react/defi/lp/position";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePositions } from "./use-positions";

function formatUsd(value: number | null): string {
  if (value === null) return "—";
  if (value === 0) return "$0";
  if (value < 0.01) return "<$0.01";
  if (value < 1000) return `$${value.toFixed(2)}`;
  if (value < 1_000_000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${(value / 1_000_000).toFixed(2)}M`;
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(2)}%`;
}

export function PositionsStrip() {
  const {
    ownerAddress,
    filteredPositions,
    chainGroups,
    totalCount,
    totalValueUsd,
    selectedChainId,
    setSelectedChainId,
    isLoading,
    refresh,
  } = usePositions();

  if (!ownerAddress) {
    return (
      <div className="px-4 py-6 text-center text-xs text-[color:var(--color-fg-muted)]">
        Connect and sign in to view positions.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[color:var(--color-border)]">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-medium text-[color:var(--color-fg)]">
            My Positions
          </span>
          <span className="text-[10px] text-[color:var(--color-fg-muted)]">
            {totalCount} active
            {totalValueUsd !== null && ` · ${formatUsd(totalValueUsd)} TVL`}
          </span>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isLoading}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-panel-2)] hover:text-[color:var(--color-fg)] disabled:opacity-50"
          aria-label="Refresh positions"
        >
          <RefreshCw size={12} className={cn(isLoading && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {chainGroups.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-1.5 border-b border-[color:var(--color-border)]">
          <ChainFilterButton
            label="All"
            active={selectedChainId === null}
            onClick={() => setSelectedChainId(null)}
          />
          {chainGroups.map((group) => (
            <ChainFilterButton
              key={group.chainId}
              label={`${group.displayName} · ${group.totalCount}`}
              active={selectedChainId === group.chainId}
              onClick={() => setSelectedChainId(group.chainId)}
            />
          ))}
        </div>
      )}

      <PositionsTable positions={filteredPositions} isLoading={isLoading} />
    </div>
  );
}

function ChainFilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
        active
          ? "bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]"
          : "text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)]",
      )}
    >
      {label}
    </button>
  );
}

function PositionsTable({
  positions,
  isLoading,
}: {
  positions: EnrichedPosition[];
  isLoading: boolean;
}) {
  if (positions.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-xs text-[color:var(--color-fg-muted)]">
        {isLoading ? "Loading positions…" : "No active positions."}
      </div>
    );
  }

  return (
    <div className="max-h-[40dvh] overflow-y-auto">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-[color:var(--color-bg)]/95 backdrop-blur-sm">
          <tr className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)]">
            <th className="px-4 py-1.5 text-left font-medium">Asset</th>
            <th className="hidden px-3 py-1.5 text-left font-medium md:table-cell">
              Chain · DEX
            </th>
            <th className="px-3 py-1.5 text-right font-medium">Range</th>
            <th className="px-3 py-1.5 text-right font-medium">Deposit</th>
            <th className="hidden px-3 py-1.5 text-right font-medium md:table-cell">
              Earned
            </th>
            <th className="px-4 py-1.5 text-right font-medium">APR</th>
          </tr>
        </thead>
        <tbody
          className={cn(
            isLoading && "[&>tr>td]:blur-[1px] pointer-events-none",
          )}
        >
          {positions.map((pos) => (
            <PositionRow
              key={`${pos.chainId}-${pos.dexId}-${pos.tokenId}`}
              position={pos}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PositionRow({ position }: { position: EnrichedPosition }) {
  const pair = `${position.token0.symbol}/${position.token1.symbol}`;
  return (
    <tr className="border-t border-[color:var(--color-border)]/60 text-xs">
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[color:var(--color-fg)]">
            {pair}
          </span>
          {position.feeTier !== null && (
            <span className="text-[10px] text-[color:var(--color-fg-muted)]">
              {(position.feeTier / 10_000).toFixed(2)}%
            </span>
          )}
        </div>
      </td>
      <td className="hidden px-3 py-2 text-[color:var(--color-fg-muted)] md:table-cell">
        {position.dexDisplayName ?? `dex#${position.dexId}`} · chain{" "}
        {position.chainId}
      </td>
      <td className="px-3 py-2 text-right">
        <span
          className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
            position.inRange
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-amber-500/15 text-amber-400",
          )}
        >
          {position.inRange ? "In range" : "Out"}
        </span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-[color:var(--color-fg)]">
        {formatUsd(position.valueUsd)}
      </td>
      <td className="hidden px-3 py-2 text-right tabular-nums text-[color:var(--color-fg)] md:table-cell">
        {formatUsd(position.earnedUsd)}
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-[color:var(--color-fg)]">
        {formatPercent(position.aprTotal)}
      </td>
    </tr>
  );
}

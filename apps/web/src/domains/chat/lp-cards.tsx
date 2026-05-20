"use client";

import { Button, Card, Pill } from "@/components/ui";
import type { LpCard } from "@/domains/agent/tools/propose-lp-positions";
import { useLpProposalStore } from "@/domains/agent/store/useLpProposalStore";
import { cn } from "@/lib/utils";

function riskTone(risk: LpCard["metrics"]["ilRisk"]): "ok" | "warn" | "danger" {
  if (risk === "low") return "ok";
  if (risk === "medium") return "warn";
  return "danger";
}

function alignmentClass(alignment: LpCard["reasoning"]["tierAlignment"]): string {
  if (alignment === "match") return "border-emerald-500/50 text-emerald-300";
  if (alignment === "stretch") return "border-yellow-500/50 text-yellow-300";
  return "border-red-500/50 text-red-300";
}

export function LpCards({ onSelect }: { onSelect: (card: LpCard) => void }) {
  const proposal = useLpProposalStore((state) => state.current);
  if (!proposal) return null;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {proposal.cards.map((card) => (
        <Card key={card.id} className="gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Pill>#{card.rank}</Pill>
              <h3 className="mt-2 text-sm font-semibold">{card.protocol}</h3>
              <p className="text-xs text-[color:var(--color-fg-muted)]">
                {card.pair.base.symbol} / {card.pair.quote.symbol}
              </p>
            </div>
            <Pill tone={riskTone(card.metrics.ilRisk)}>{card.metrics.ilRisk} IL</Pill>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-[color:var(--color-border)] p-2">
              <div className="text-[color:var(--color-fg-muted)]">APR</div>
              <div className="mt-1 font-medium">{card.metrics.apr.toFixed(2)}%</div>
            </div>
            <div className="rounded-md border border-[color:var(--color-border)] p-2">
              <div className="text-[color:var(--color-fg-muted)]">TVL</div>
              <div className="mt-1 font-medium">${card.metrics.tvlUsd.toLocaleString()}</div>
            </div>
          </div>

          <div
            className={cn(
              "rounded-md border px-2 py-1 text-xs",
              alignmentClass(card.reasoning.tierAlignment),
            )}
          >
            {card.reasoning.tierAlignment}
          </div>

          <p className="text-xs leading-5 text-[color:var(--color-fg-muted)]">
            {card.reasoning.fitForTier}
          </p>

          <div className="space-y-2 text-xs">
            <div>
              <div className="font-medium">Pros</div>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-[color:var(--color-fg-muted)]">
                {card.reasoning.pros.slice(0, 2).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-medium">Cons</div>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-[color:var(--color-fg-muted)]">
                {card.reasoning.cons.slice(0, 2).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-xs">
              <div className="text-[color:var(--color-fg-muted)]">Suggested</div>
              <div className="font-semibold">${card.position.suggestedAmountUsd.toLocaleString()}</div>
            </div>
            <Button size="sm" onClick={() => onSelect(card)}>
              Choose
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

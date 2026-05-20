"use client";

import { Button } from "@/components/ui";
import { useApp } from "@/state/app-state";
import { formatUsd } from "@/lib/utils";

export function BasketBar() {
  const { state, dispatch } = useApp();
  if (state.basket.length === 0) return null;
  const total = state.basket.reduce((acc, b) => acc + b.amountUsd, 0);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--color-border)] bg-[color:var(--color-panel)]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6">
        <div className="text-sm">
          <span className="text-[color:var(--color-fg-muted)]">Basket:</span>{" "}
          <strong>{state.basket.length}</strong> position(s) · {formatUsd(total)}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="flex-1 sm:flex-none" onClick={() => dispatch({ type: "BASKET_CLEAR" })}>
            Clear
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={() => dispatch({ type: "GOTO", stage: "basket-review" })}>
            Review basket →
          </Button>
        </div>
      </div>
    </div>
  );
}

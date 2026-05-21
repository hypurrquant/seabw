"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PositionsStrip } from "./positions-strip";
import { usePositions } from "./use-positions";

// Curtain — sits above the /chat split. Click the tab to slide the LP
// dashboard down; click again to retract.
export function PositionsCurtain() {
  const [open, setOpen] = useState(false);
  const { totalCount, ownerAddress } = usePositions();

  return (
    <div className="relative border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]">
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
        aria-hidden={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <PositionsStrip />
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="positions-curtain"
          className="group inline-flex items-center gap-2 rounded-b-md border border-t-0 border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-3 py-1 text-[11px] text-[color:var(--color-fg-muted)] shadow-sm hover:text-[color:var(--color-fg)]"
        >
          <span>My Positions</span>
          {ownerAddress !== null && (
            <span className="rounded bg-[color:var(--color-panel-2)] px-1.5 py-0.5 text-[10px] tabular-nums">
              {totalCount}
            </span>
          )}
          <ChevronDown
            size={14}
            className={cn(
              "transition-transform duration-300",
              open && "rotate-180",
            )}
          />
        </button>
      </div>
    </div>
  );
}

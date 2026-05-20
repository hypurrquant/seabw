"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp, type Stage } from "@/state/app-state";

// Four-step breadcrumb users see across the plan-build journey. Hidden on
// landing/wallet/execution stages — those have their own affordances and a
// stepper above them would only add noise.
const STEPS: { id: "survey" | "result" | "build" | "review"; label: string; stages: Stage[] }[] = [
  { id: "survey", label: "Survey", stages: ["survey"] },
  { id: "result", label: "Result", stages: ["tier-result"] },
  { id: "build", label: "Build", stages: ["intent", "marketplace", "basket-review"] },
  { id: "review", label: "Review", stages: ["plan-review"] },
];

const STAGE_TO_INDEX: Record<Stage, number> = {
  landing: -1,
  survey: 0,
  "tier-result": 1,
  "mode-choice": 1,
  "connect-wallet": -1,
  intent: 2,
  marketplace: 2,
  "basket-review": 2,
  "plan-review": 3,
  execution: -1,
  portfolio: -1,
};

export function StageIndicator() {
  const { state, dispatch } = useApp();
  const current = STAGE_TO_INDEX[state.stage];
  if (current < 0) return null;

  return (
    <nav
      aria-label="Plan progress"
      className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/70"
    >
      <ol className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-3 text-xs sm:gap-3 sm:px-6">
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const clickable = done; // only backwards navigation
          const onClick = () => {
            if (!clickable) return;
            dispatch({ type: "GOTO", stage: step.stages[0] });
          };
          return (
            <li key={step.id} className="flex flex-1 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onClick}
                disabled={!clickable}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-1 transition-opacity",
                  clickable ? "hover:opacity-80 focus-ring" : "cursor-default",
                  !active && !done && "opacity-50",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums",
                    active &&
                      "border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-white",
                    done &&
                      "border-[color:var(--color-success)] bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
                    !active && !done && "border-[color:var(--color-border)] text-[color:var(--color-fg-muted)]",
                  )}
                >
                  {done ? <Check size={12} strokeWidth={2.5} /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-[color:var(--color-fg)] sm:inline",
                    active && "font-semibold",
                    !active && "text-[color:var(--color-fg-muted)]",
                  )}
                >
                  {step.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px flex-1 transition-colors",
                    i < current
                      ? "bg-[color:var(--color-success)]/45"
                      : "bg-[color:var(--color-border)]",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

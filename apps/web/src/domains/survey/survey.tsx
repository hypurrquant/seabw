"use client";

import { useState } from "react";
import { SURVEY_QUESTIONS, deriveTier, cacheTier } from "./lib";
import type {
  AgeBucket,
  Answers,
  AnswerScore,
  DefiExperienceCategory,
} from "./lib";
import { Button, Card, ProgressBar, Pill } from "@/components/ui";
import { useApp } from "@/state/app-state";
import { cn } from "@/lib/utils";

const DEFAULT_ANSWERS: Answers = {
  horizon: 1,
  allocation: 1,
  experienceProducts: [],
  experienceYears: 1,
  returnAttitude: 1,
  lossTolerance: 1,
  literacy: 1,
  derivativeExp: 1,
  ageBucket: "under65",
  firstTimeDefiPilot: false,
};

export function Survey() {
  const { dispatch } = useApp();
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [touched, setTouched] = useState<Partial<Record<keyof Answers, true>>>({});

  const setScore = (questionId: keyof Answers, score: AnswerScore) => {
    setAnswers((prev) => ({ ...prev, [questionId]: score } as Answers));
    setTouched((t) => ({ ...t, [questionId]: true }));
  };

  const toggleMulti = (value: DefiExperienceCategory) => {
    setAnswers((prev) => {
      const current = prev.experienceProducts;
      const next = current.includes(value)
        ? current.filter((x) => x !== value)
        : [...current, value];
      return { ...prev, experienceProducts: next };
    });
    setTouched((t) => ({ ...t, experienceProducts: true }));
  };

  const setMetaAge = (v: AgeBucket) =>
    setAnswers((prev) => ({ ...prev, ageBucket: v }));
  const setMetaFirst = (v: boolean) =>
    setAnswers((prev) => ({ ...prev, firstTimeDefiPilot: v }));

  // Progress = number of REQUIRED single-select questions answered.
  // Multi-select Q3 (experienceProducts) and the meta consent never block — they always count as filled.
  const requiredKeys: (keyof Answers)[] = [
    "horizon",
    "allocation",
    "experienceYears",
    "returnAttitude",
    "lossTolerance",
    "literacy",
    "derivativeExp",
  ];
  const filledCount = requiredKeys.filter((k) => touched[k] === true).length;
  const allFilled = filledCount === requiredKeys.length;

  const submit = () => {
    if (!allFilled) return;
    const tier = deriveTier(answers);
    cacheTier({ result: tier, answers });
    dispatch({ type: "SET_ANSWERS", answers });
    dispatch({ type: "SET_TIER", tier });
  };

  const back = () => dispatch({ type: "GOTO", stage: "landing" });

  const remaining = requiredKeys.length - filledCount;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-3xl flex-col gap-6 px-6 py-10 pb-32">
      <header className="flex flex-col gap-3">
        <Pill>Risk profile · KOFIA 5-tier model</Pill>
        <h1 className="text-3xl font-semibold tracking-tight">
          Tell us about your DeFi risk capacity
        </h1>
        <p className="text-sm text-[color:var(--color-fg-muted)]">
          This sets how far your stablecoins are allowed to travel — from
          stable-only lending to leveraged LP. 8 questions plus a
          vulnerable-consumer self-check, all on one page. Answer in any order.
        </p>
        <div>
          <div className="mb-1 text-xs text-[color:var(--color-fg-muted)]">
            {filledCount} / {requiredKeys.length} required answered
          </div>
          <ProgressBar value={filledCount} max={requiredKeys.length} />
        </div>
      </header>

      {SURVEY_QUESTIONS.map((q, idx) => (
        <Card key={q.id} className="w-full">
          <div className="flex items-center justify-between gap-2">
            <Pill>Q{idx + 1}</Pill>
            <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)]">
              {q.category}
            </span>
          </div>
          <h2 className="text-base font-semibold leading-snug">{q.question}</h2>
          {q.hint && (
            <p className="text-xs text-[color:var(--color-fg-muted)]">{q.hint}</p>
          )}
          {q.multi ? (
            <div className="flex flex-col gap-2">
              {q.options.map((opt) =>
                opt.kind === "multi" ? (
                  <button
                    key={opt.value}
                    onClick={() => toggleMulti(opt.value)}
                    className={cn(
                      "panel-2 flex items-center justify-between px-4 py-3 text-left transition-colors",
                      answers.experienceProducts.includes(opt.value)
                        ? "border-[color:var(--color-accent)] ring-2 ring-[color:var(--color-accent)]/30"
                        : "hover:border-[color:var(--color-accent)]/40",
                    )}
                  >
                    <span className="text-sm">{opt.label}</span>
                    <span className="text-xs text-[color:var(--color-fg-muted)]">
                      {answers.experienceProducts.includes(opt.value)
                        ? "✓ Selected"
                        : "Tap to select"}
                    </span>
                  </button>
                ) : null,
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {q.options.map((opt) =>
                opt.kind === "single" ? (
                  <button
                    key={opt.score}
                    onClick={() => setScore(q.id, opt.score)}
                    className={cn(
                      "panel-2 flex items-center justify-between px-4 py-3 text-left transition-colors",
                      answers[q.id] === opt.score && touched[q.id]
                        ? "border-[color:var(--color-accent)] ring-2 ring-[color:var(--color-accent)]/30"
                        : "hover:border-[color:var(--color-accent)]/40",
                    )}
                  >
                    <span className="text-sm">{opt.label}</span>
                    <span className="text-xs text-[color:var(--color-fg-muted)]">
                      +{opt.score}
                    </span>
                  </button>
                ) : null,
              )}
            </div>
          )}
        </Card>
      ))}

      <Card>
        <div className="flex items-center justify-between gap-2">
          <Pill>Meta</Pill>
          <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)]">
            Vulnerable-consumer self-check
          </span>
        </div>
        <h2 className="text-base font-semibold leading-snug">
          Tick anything that applies (skip if none)
        </h2>
        <p className="text-xs text-[color:var(--color-fg-muted)]">
          Either box triggers an automatic one-tier downgrade for extra
          protection. We do not raise the tier back up without explicit re-consent.
        </p>
        <CheckRow
          checked={answers.ageBucket === "over65"}
          onToggle={() =>
            setMetaAge(answers.ageBucket === "over65" ? "under65" : "over65")
          }
          label="I am 65 or older"
          hint="Treated as a vulnerable consumer per KOFIA rules"
        />
        <CheckRow
          checked={answers.firstTimeDefiPilot}
          onToggle={() => setMetaFirst(!answers.firstTimeDefiPilot)}
          label="DeFi is brand new for me"
          hint="One tier safer until you are comfortable"
        />
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--color-border)] bg-[color:var(--color-panel)]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-6 py-3">
          <Button variant="ghost" onClick={back}>
            ← Back to landing
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[color:var(--color-fg-muted)]">
              {filledCount} / {requiredKeys.length} required answered
              {!allFilled && ` · ${remaining} left`}
            </span>
            <Button onClick={submit} disabled={!allFilled}>
              See my tier →
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function CheckRow({
  checked,
  onToggle,
  label,
  hint,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "panel-2 flex items-start justify-between gap-3 px-4 py-3 text-left transition-colors",
        checked
          ? "border-[color:var(--color-accent)] ring-2 ring-[color:var(--color-accent)]/30"
          : "hover:border-[color:var(--color-accent)]/40",
      )}
    >
      <div>
        <div className="text-sm">{label}</div>
        {hint && (
          <div className="text-[10px] text-[color:var(--color-fg-muted)]">{hint}</div>
        )}
      </div>
      <span className="text-xs text-[color:var(--color-fg-muted)]">
        {checked ? "✓" : ""}
      </span>
    </button>
  );
}


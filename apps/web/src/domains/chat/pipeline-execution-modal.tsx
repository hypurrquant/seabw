"use client";

import { useEffect, useRef, useState } from "react";
import { usePipelineStore } from "@hq/react/agent";
import { Button, ModalContainer, Pill, ProgressBar } from "@/components/ui";
import { selectLpCard } from "@/domains/agent/runtime/select-lp-card";
import { executePendingPipeline } from "@/domains/agent/runtime/execute-pipeline";
import { useLpExecutionModal } from "./use-lp-execution-modal";

type Phase = "resolving" | "idle" | "executing" | "complete" | "error";

export function PipelineExecutionModal({
  sessionId,
  ownerAddress,
}: {
  sessionId: string | null;
  ownerAddress: `0x${string}` | undefined;
}) {
  const { card, isOpen, close } = useLpExecutionModal();
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const initRef = useRef<string | null>(null);

  const entry = usePipelineStore((s) => (pipelineId ? s.pipelines[pipelineId] : undefined));
  const progress = usePipelineStore((s) => (pipelineId ? s.progress[pipelineId] : undefined));

  // Resolve recipe → pipelineId, once per opened card.
  useEffect(() => {
    if (!isOpen || !card || !sessionId || !ownerAddress) return;
    if (initRef.current === card.id) return;
    initRef.current = card.id;
    setPipelineId(null);
    setResolveError(null);
    setExecuteError(null);

    void (async () => {
      try {
        const id = await selectLpCard(card, { ownerAddress, sessionId });
        setPipelineId(id);
      } catch (err) {
        setResolveError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [isOpen, card, sessionId, ownerAddress]);

  // Reset init guard when modal closes.
  useEffect(() => {
    if (!isOpen) {
      initRef.current = null;
      setPipelineId(null);
      setResolveError(null);
      setExecuteError(null);
    }
  }, [isOpen]);

  if (!isOpen || !card) return null;

  let phase: Phase = "resolving";
  if (resolveError) phase = "error";
  else if (!pipelineId || !entry) phase = "resolving";
  else if (entry.status === "executing") phase = "executing";
  else if (entry.status === "executed") phase = "complete";
  else if (
    entry.status === "failed" ||
    entry.status === "resolve_failed" ||
    entry.status === "rejected"
  )
    phase = "error";
  else phase = "idle";

  const isExecuting = phase === "executing";
  const errorMessage =
    resolveError ||
    executeError ||
    (entry?.status === "failed" || entry?.status === "resolve_failed"
      ? entry.error
      : entry?.status === "rejected"
        ? "Pipeline rejected."
        : null);

  async function onExecute() {
    if (!pipelineId || !sessionId || !ownerAddress) return;
    setExecuteError(null);
    try {
      await executePendingPipeline(pipelineId, sessionId, ownerAddress);
    } catch (err) {
      setExecuteError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onRetry() {
    setExecuteError(null);
    setResolveError(null);
    // Re-trigger resolve by clearing init guard.
    initRef.current = null;
    setPipelineId(null);
    // Effect dependency re-fires once initRef cleared and card unchanged — force via a
    // synthetic re-set by toggling isOpen would close the modal, so instead just call
    // selectLpCard again here directly.
    if (!card || !sessionId || !ownerAddress) return;
    initRef.current = card.id;
    try {
      const id = await selectLpCard(card, { ownerAddress, sessionId });
      setPipelineId(id);
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={close}
      closeOnBackdrop={!isExecuting}
      size="md"
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <Pill>LP Execution</Pill>
            <h3 className="mt-2 text-base font-semibold">
              {card.protocol} · {card.pair.base.symbol} / {card.pair.quote.symbol}
            </h3>
            <p className="text-xs text-[color:var(--color-fg-muted)]">
              Suggested ${card.position.suggestedAmountUsd.toLocaleString()}
            </p>
          </div>
          {!isExecuting && (
            <button
              onClick={close}
              className="text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {phase === "resolving" && (
            <div className="rounded-md border border-[color:var(--color-border)] p-3 text-sm text-[color:var(--color-fg-muted)]">
              실행 계획을 준비하는 중이에요…
            </div>
          )}

          {(phase === "idle" || phase === "executing" || phase === "complete") &&
            entry?.summary && (
              <div className="space-y-1 text-xs">
                {entry.summary.map((item) => (
                  <div
                    key={item.stageId}
                    className="rounded-md border border-[color:var(--color-border)] px-3 py-2"
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            )}

          {phase === "executing" && (
            <div className="space-y-2">
              <ProgressBar
                value={progress?.currentStep ?? 0}
                max={progress?.totalSteps ?? 1}
              />
              <p className="text-xs text-[color:var(--color-fg-muted)]">
                Step {progress?.currentStep ?? 0} / {progress?.totalSteps ?? 0}
              </p>
            </div>
          )}

          {phase === "complete" && entry?.status === "executed" && (
            <div className="space-y-2">
              <Pill tone="ok">Executed</Pill>
              <div className="space-y-1 text-xs">
                {entry.txHashes.map((hash) => (
                  <div
                    key={hash}
                    className="rounded-md border border-[color:var(--color-border)] px-3 py-2 font-mono text-[color:var(--color-fg-muted)]"
                  >
                    {hash}
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === "error" && (
            <div className="rounded-md border border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/10 p-3 text-xs text-[color:var(--color-danger)]">
              {errorMessage ?? "Pipeline failed."}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {phase === "idle" && (
            <Button onClick={() => void onExecute()} size="md">
              Execute
            </Button>
          )}
          {phase === "complete" && (
            <Button variant="secondary" onClick={close}>
              Close
            </Button>
          )}
          {phase === "error" && (
            <>
              <Button variant="ghost" onClick={close}>
                Close
              </Button>
              <Button onClick={() => void onRetry()}>Retry</Button>
            </>
          )}
        </div>
      </div>
    </ModalContainer>
  );
}

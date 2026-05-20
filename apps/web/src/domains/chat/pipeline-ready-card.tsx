"use client";

import { useState } from "react";
import { usePipelineStore } from "@hq/react/agent";
import { Button, Card, Pill, ProgressBar } from "@/components/ui";
import { executePendingPipeline } from "@/domains/agent/runtime/execute-pipeline";

export function PipelineReadyCard({
  pipelineId,
  sessionId,
  ownerAddress,
}: {
  pipelineId: string;
  sessionId: string;
  ownerAddress: `0x${string}`;
}) {
  const entry = usePipelineStore((state) => state.pipelines[pipelineId]);
  const progress = usePipelineStore((state) => state.progress[pipelineId]);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!entry) return null;

  async function onExecute() {
    setLocalError(null);
    try {
      await executePendingPipeline(pipelineId, sessionId, ownerAddress);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <Card className="self-start p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Pill>Pipeline Ready</Pill>
          <h3 className="mt-2 text-sm font-semibold">LP execution plan</h3>
        </div>
        <Pill
          tone={
            entry.status === "executed"
              ? "ok"
              : entry.status === "failed" || entry.status === "resolve_failed" || entry.status === "rejected"
                ? "danger"
                : "default"
          }
        >
          {entry.status}
        </Pill>
      </div>

      <div className="space-y-1 text-sm">
        {entry.summary.map((item) => (
          <div key={item.stageId} className="rounded-md border border-[color:var(--color-border)] px-3 py-2">
            {item.label}
          </div>
        ))}
      </div>

      {entry.status === "pending" && (
        <Button onClick={() => void onExecute()} size="sm">
          Execute
        </Button>
      )}

      {entry.status === "executing" && (
        <div className="space-y-2">
          <ProgressBar value={progress?.currentStep ?? 0} max={progress?.totalSteps ?? 1} />
          <p className="text-xs text-[color:var(--color-fg-muted)]">
            Step {progress?.currentStep ?? 0} / {progress?.totalSteps ?? 0}
          </p>
        </div>
      )}

      {entry.status === "executed" && (
        <div className="space-y-2 text-xs">
          <Pill tone="ok">Executed</Pill>
          {entry.txHashes.map((hash) => (
            <div key={hash} className="font-mono text-[color:var(--color-fg-muted)]">
              {hash.slice(0, 8)}...
            </div>
          ))}
        </div>
      )}

      {(entry.status === "failed" || entry.status === "resolve_failed") && (
        <p className="text-xs text-[color:var(--color-danger)]">{entry.error}</p>
      )}
      {entry.status === "rejected" && (
        <p className="text-xs text-[color:var(--color-danger)]">Pipeline rejected.</p>
      )}
      {localError && <p className="text-xs text-[color:var(--color-danger)]">{localError}</p>}
    </Card>
  );
}

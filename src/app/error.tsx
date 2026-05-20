"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[defipilot] client error:", error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
      <div className="panel-2 w-full p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Something broke client-side.</h1>
        <p className="mt-2 text-sm text-[color:var(--color-fg-muted)]">
          DefiPilot did not broadcast any transaction. Your wallet state is untouched.
        </p>
        <pre className="panel mt-4 max-h-40 overflow-auto p-3 text-left text-xs text-[color:var(--color-fg-muted)] whitespace-pre-wrap">
          {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="secondary" onClick={() => reset()}>
            Try again
          </Button>
          <Button onClick={() => (window.location.href = "/")}>Back to start</Button>
        </div>
      </div>
    </main>
  );
}

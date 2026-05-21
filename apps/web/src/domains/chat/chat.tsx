"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAgentChat, useAgentStore } from "@hq/react/agent";
import { Button, Card, Pill } from "@/components/ui";
import { useApp } from "@/state/app-state";
import { buildTendencyPrompt } from "@/lib/tendency-prompt";
import { useHqClient } from "@/domains/auth/hq-client-provider";
import { useWalletModal } from "@/domains/wallet/wallet-modal-context";
import { LpCards } from "./lp-cards";
import { PipelineExecutionModal } from "./pipeline-execution-modal";
import { useLpExecutionModal } from "./use-lp-execution-modal";
import type { LpCard } from "@/domains/agent/tools/propose-lp-positions";

export function Chat() {
  const { state, dispatch } = useApp();
  const hq = useHqClient();
  const walletModal = useWalletModal();
  const chat = useAgentChat();
  const openExecutionModal = useLpExecutionModal((s) => s.open);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  const messages = useAgentStore(
    (store) => store.sessionStateById?.[sessionId ?? ""]?.messages ?? [],
  );
  const lastError = useAgentStore(
    (store) => store.sessionStateById?.[sessionId ?? ""]?.lastError ?? null,
  );
  const streamingSessionId = useAgentStore((store) => store.streamingSessionId);

  const ownerAddress = state.auth.status === "authed" ? state.auth.ownerAddress : undefined;
  const busy = streamingSessionId !== null;

  const handleAuthError = useCallback(
    (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("401") || message.toLowerCase().includes("auth")) {
        dispatch({ type: "AUTH_RESET" });
        walletModal.open();
        setError("Session expired. Sign in again.");
        return;
      }
      setError(message);
    },
    [dispatch, walletModal],
  );

  const sendToAgent = useCallback(
    async (text: string, sid: string) => {
      setError(null);
      try {
        await chat.sendMessage(text, sid);
      } catch (err) {
        handleAuthError(err);
      }
    },
    [chat, handleAuthError],
  );

  useEffect(() => {
    if (initRef.current) return;
    if (state.auth.status !== "authed") {
      console.info("[chat] waiting for auth", { status: state.auth.status });
      return;
    }
    if (!state.answers || !state.tier) {
      console.info("[chat] waiting for answers/tier", {
        hasAnswers: !!state.answers,
        hasTier: !!state.tier,
      });
      return;
    }
    initRef.current = true;
    console.info("[chat] creating HQ session", { tier: state.tier.tier });

    // No `cancelled` guard — Strict Mode tears the effect down then re-runs.
    // initRef prevents duplicate fires, and setState on unmounted is a silent
    // no-op in React 18+.
    void (async () => {
      try {
        const sid = await hq.createSession({ answers: state.answers!, tier: state.tier! });
        console.info("[chat] session ok", { sessionId: sid });
        setSessionId(sid);
        const first = buildTendencyPrompt(state.answers!, state.tier!);
        console.info("[chat] sending tendency prompt", { len: first.length });
        await sendToAgent(first, sid);
      } catch (err) {
        console.error("[chat] session/send failure", err);
        handleAuthError(err);
      }
    })();
  }, [handleAuthError, hq, sendToAgent, state.answers, state.auth.status, state.tier]);

  async function onSend() {
    const text = input.trim();
    if (!text || !sessionId || busy) return;
    setInput("");
    await sendToAgent(text, sessionId);
  }

  function onSelectLpCard(card: LpCard) {
    if (!sessionId || !ownerAddress) {
      setError("Wallet/session not ready");
      return;
    }
    openExecutionModal(card);
  }

  async function onRequestRecommendations() {
    if (!sessionId || !state.answers || !state.tier || busy) return;
    await sendToAgent(buildTendencyPrompt(state.answers, state.tier), sessionId);
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-5xl flex-col px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pill>DefiPilot Chat</Pill>
        <div className="flex items-center gap-2">
          {process.env.NODE_ENV !== "production" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onRequestRecommendations()}
              disabled={!sessionId || busy}
            >
              🔄 Re-request
            </Button>
          )}
          <Button variant="ghost" onClick={() => dispatch({ type: "GOTO", stage: "tier-result" })}>
            ← Back to report
          </Button>
        </div>
      </div>

      {(error || lastError) && (
        <div className="panel-2 mt-3 border-[color:var(--color-danger)]/40 p-3 text-xs text-[color:var(--color-danger)]">
          {error ?? lastError?.message}
        </div>
      )}

      <div className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto pb-3">
        {messages.length === 0 && (
          <Card>
            <p className="text-sm text-[color:var(--color-fg-muted)]">Preparing session…</p>
          </Card>
        )}

        {messages.map((message) => (
          <Card
            key={message.id}
            className={
              message.role === "user"
                ? "self-end max-w-[80%] bg-[color:var(--color-panel-2)]"
                : "self-start max-w-[80%]"
            }
          >
            <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)]">
              {message.role}
            </div>
            <div className="prose prose-sm prose-invert mt-1 max-w-none text-sm [&_*]:my-1 [&_code]:rounded [&_code]:bg-[color:var(--color-panel-2)] [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-[color:var(--color-panel-2)] [&_pre]:p-2 [&_a]:text-[color:var(--color-accent)] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
              {message.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              ) : busy && message.id === messages[messages.length - 1]?.id ? (
                "…"
              ) : null}
            </div>
          </Card>
        ))}

        <LpCards onSelect={onSelectLpCard} />
      </div>

      <PipelineExecutionModal sessionId={sessionId} ownerAddress={ownerAddress} />

      <div className="flex gap-2 border-t border-[color:var(--color-border)] pt-3">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void onSend();
            }
          }}
          disabled={busy || !sessionId}
          placeholder={!sessionId ? "Preparing session…" : busy ? "Thinking…" : "Type a message (Enter)"}
          className="flex-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]"
        />
        <Button onClick={() => void onSend()} disabled={busy || !input.trim() || !sessionId}>
          Send
        </Button>
      </div>
    </main>
  );
}

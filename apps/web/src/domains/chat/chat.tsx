"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgentChat, useAgentStore } from "@hq/react/agent";
import { Button, Card, Pill } from "@/components/ui";
import { useApp } from "@/state/app-state";
import { buildTendencyPrompt } from "@/lib/tendency-prompt";
import { useHqClient } from "@/domains/auth/hq-client-provider";
import { useWalletModal } from "@/domains/wallet/wallet-modal-context";
import { LpCards } from "./lp-cards";
import { PipelineReadyCard } from "./pipeline-ready-card";
import { selectLpCard } from "@/domains/agent/runtime/select-lp-card";
import type { LpCard } from "@/domains/agent/tools/propose-lp-positions";

export function Chat() {
  const { state, dispatch } = useApp();
  const hq = useHqClient();
  const walletModal = useWalletModal();
  const chat = useAgentChat();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [localPipelineIds, setLocalPipelineIds] = useState<string[]>([]);
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
    if (state.auth.status !== "authed") return;
    if (!state.answers || !state.tier) return;
    initRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const sid = await hq.createSession({ answers: state.answers!, tier: state.tier! });
        if (cancelled) return;
        setSessionId(sid);
        const first = buildTendencyPrompt(state.answers!, state.tier!);
        await sendToAgent(first, sid);
      } catch (err) {
        handleAuthError(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handleAuthError, hq, sendToAgent, state.answers, state.auth.status, state.tier]);

  async function onSend() {
    const text = input.trim();
    if (!text || !sessionId || busy) return;
    setInput("");
    await sendToAgent(text, sessionId);
  }

  async function onSelectLpCard(card: LpCard) {
    if (!sessionId || !ownerAddress) return;
    try {
      const pipelineId = await selectLpCard(card, { ownerAddress, sessionId });
      setLocalPipelineIds((prev) => (prev.includes(pipelineId) ? prev : [...prev, pipelineId]));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
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
              🔄 추천 재요청
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
            <p className="text-sm text-[color:var(--color-fg-muted)]">세션을 준비하는 중이에요…</p>
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
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {message.content || (busy && message.id === messages[messages.length - 1]?.id ? "…" : "")}
            </p>
          </Card>
        ))}

        <LpCards onSelect={(card) => void onSelectLpCard(card)} />

        {sessionId &&
          ownerAddress &&
          localPipelineIds.map((pipelineId) => (
            <PipelineReadyCard
              key={pipelineId}
              pipelineId={pipelineId}
              sessionId={sessionId}
              ownerAddress={ownerAddress}
            />
          ))}
      </div>

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
          placeholder={!sessionId ? "세션 준비 중…" : busy ? "응답 중…" : "메시지를 입력하세요 (Enter)"}
          className="flex-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]"
        />
        <Button onClick={() => void onSend()} disabled={busy || !input.trim() || !sessionId}>
          Send
        </Button>
      </div>
    </main>
  );
}

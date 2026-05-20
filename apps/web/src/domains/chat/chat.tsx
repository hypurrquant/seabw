"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Pill } from "@/components/ui";
import { useApp } from "@/state/app-state";
import { buildTendencyPrompt } from "@/lib/tendency-prompt";
import { chatStream, createSession, submitToolResult } from "@/lib/hq-api";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export function Chat() {
  const { state, dispatch } = useApp();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // 진입 시 1회: HQ 세션 생성 (profile 동봉) + tendency 첫 메시지 자동 발송
  useEffect(() => {
    if (initRef.current) return;
    if (!state.answers || !state.tier) return;
    initRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        setBusy(true);
        const sid = await createSession({ answers: state.answers!, tier: state.tier! });
        if (cancelled) return;
        setSessionId(sid);
        const first = buildTendencyPrompt(state.answers!, state.tier!);
        await runChat(sid, first, true);
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runChat(sid: string, userMessage: string, isFirst = false) {
    setBusy(true);
    setError(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const userTurn: ChatMessage = { role: "user", content: userMessage };
    const assistantTurn: ChatMessage = { role: "assistant", content: "" };
    setMessages((prev) =>
      isFirst ? [userTurn, assistantTurn] : [...prev, userTurn, assistantTurn],
    );

    try {
      for await (const evt of chatStream(sid, userMessage, ac.signal)) {
        if (evt.event === "stream") {
          const d = evt.data as { delta?: string };
          if (typeof d?.delta === "string") {
            const delta = d.delta;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (!last || last.role !== "assistant") return prev;
              const updated = { ...last, content: last.content + delta };
              return [...prev.slice(0, -1), updated];
            });
          }
        } else if (evt.event === "tool_call") {
          const d = evt.data as { toolCallId?: string; toolName?: string };
          if (d?.toolCallId) {
            void submitToolResult(sid, d.toolCallId, {
              status: "error",
              code: "TOOL_NOT_IMPLEMENTED",
              message: `Tool '${d.toolName ?? "?"}' is not implemented in v1.2.0. Coming in v1.3.0.`,
            });
          }
        } else if (evt.event === "error") {
          const d = evt.data as { message?: string };
          setError(d?.message ?? "HQ chat error");
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    const text = input.trim();
    if (!text || !sessionId || busy) return;
    setInput("");
    await runChat(sessionId, text);
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-3xl flex-col px-6 py-6">
      <div className="flex items-center justify-between">
        <Pill>DefiPilot Chat</Pill>
        <Button variant="ghost" onClick={() => dispatch({ type: "GOTO", stage: "tier-result" })}>
          ← Back to report
        </Button>
      </div>

      {error && (
        <div className="panel-2 mt-3 border-[color:var(--color-danger)]/40 p-3 text-xs text-[color:var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto pb-3">
        {messages.length === 0 && (
          <Card>
            <p className="text-sm text-[color:var(--color-fg-muted)]">
              세션을 준비하는 중이에요…
            </p>
          </Card>
        )}
        {messages.map((m, i) => (
          <Card
            key={i}
            className={
              m.role === "user"
                ? "self-end max-w-[80%] bg-[color:var(--color-panel-2)]"
                : "self-start max-w-[80%]"
            }
          >
            <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)]">
              {m.role}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {m.content || (busy && i === messages.length - 1 ? "…" : "")}
            </p>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 border-t border-[color:var(--color-border)] pt-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
          disabled={busy || !sessionId}
          placeholder={
            !sessionId ? "세션 준비 중…" : busy ? "응답 중…" : "메시지를 입력하세요 (Enter)"
          }
          className="flex-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]"
        />
        <Button onClick={() => void onSend()} disabled={busy || !input.trim() || !sessionId}>
          Send
        </Button>
      </div>
    </main>
  );
}

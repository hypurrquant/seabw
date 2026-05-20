import type { Answers, TierResult } from "@/domains/survey/lib";

const HQ_BASE = process.env.NEXT_PUBLIC_HQ_BASE_URL ?? "http://localhost:3001";
const DEV_BEARER = process.env.NEXT_PUBLIC_HQ_DEV_BEARER ?? "dev";

export interface InvestorProfile {
  answers: Answers;
  tier: TierResult;
}

export interface ChatEvent {
  event: "stream" | "tool_call" | "title_update" | "done" | "error";
  data: unknown;
}

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${DEV_BEARER}` };
}

export async function createSession(profile?: InvestorProfile): Promise<string> {
  const res = await fetch(`${HQ_BASE}/agent/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ profile }),
  });
  if (!res.ok) {
    throw new Error(`HQ createSession failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { data?: { sessionId?: string } };
  const sessionId = json.data?.sessionId;
  if (!sessionId) throw new Error("HQ createSession returned no sessionId");
  return sessionId;
}

export async function* chatStream(
  sessionId: string,
  message: string,
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent, void, unknown> {
  const res = await fetch(`${HQ_BASE}/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ sessionId, message }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`HQ chat HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const parsed = parseSseFrame(raw);
      if (parsed) yield parsed;
    }
  }
  const tail = buf.trim();
  if (tail) {
    const parsed = parseSseFrame(tail);
    if (parsed) yield parsed;
  }
}

function parseSseFrame(raw: string): ChatEvent | null {
  let event = "";
  let dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!event) return null;
  const dataStr = dataLines.join("\n");
  let data: unknown = {};
  if (dataStr) {
    try {
      data = JSON.parse(dataStr);
    } catch {
      data = { raw: dataStr };
    }
  }
  return { event: event as ChatEvent["event"], data };
}

export async function submitToolResult(
  sessionId: string,
  toolCallId: string,
  result: { status: "success" | "error"; code?: string; message?: string; data?: unknown },
): Promise<void> {
  await fetch(`${HQ_BASE}/agent/tool-result`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ sessionId, toolCallId, result }),
  }).catch((err: unknown) => {
    console.warn("[hq-api] submitToolResult failed", err);
  });
}

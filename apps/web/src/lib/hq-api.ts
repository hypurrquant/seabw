import type { Answers, TierResult } from "@/domains/survey/lib";

const HQ_BASE =
  process.env.NEXT_PUBLIC_HQ_BASE_URL ?? "http://localhost:3003/api/v1";

export interface InvestorProfile {
  answers: Answers;
  tier: TierResult;
}

export interface ChatEvent {
  event: "stream" | "tool_call" | "title_update" | "done" | "error";
  data: unknown;
}

export class HqAuthRequiredError extends Error {
  constructor() {
    super("No auth token available — sign in required");
    this.name = "HqAuthRequiredError";
  }
}

export class HqUnauthorizedError extends Error {
  constructor() {
    super("HQ returned 401 — token rejected");
    this.name = "HqUnauthorizedError";
  }
}

export interface HqAuth {
  getToken: () => string | null;
}

export interface HqClient {
  createSession: (profile?: InvestorProfile) => Promise<string>;
  chatStream: (
    sessionId: string,
    message: string,
    signal?: AbortSignal,
  ) => AsyncGenerator<ChatEvent, void, unknown>;
  submitToolResult: (
    sessionId: string,
    toolCallId: string,
    result: {
      status: "success" | "error";
      code?: string;
      message?: string;
      data?: unknown;
    },
  ) => Promise<void>;
}

export async function getChallenge(address: string): Promise<string> {
  const url = `${HQ_BASE}/agent/auth/challenge?address=${encodeURIComponent(address)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HQ challenge failed: ${res.status}`);
  }
  const json = (await res.json()) as { data?: { challenge?: string } };
  const challenge = json.data?.challenge;
  if (!challenge) throw new Error("HQ challenge: missing field");
  return challenge;
}

export async function verifySignature(input: {
  address: string;
  challenge: string;
  signature: string;
}): Promise<{ token: string; expiresAt: number }> {
  const res = await fetch(`${HQ_BASE}/agent/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 401) {
    throw new HqUnauthorizedError();
  }
  if (!res.ok) {
    throw new Error(`HQ verify failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { token?: string; expiresAt?: number };
  };
  const { token, expiresAt } = json.data ?? {};
  if (!token || typeof expiresAt !== "number") {
    throw new Error("HQ verify: missing fields");
  }
  return { token, expiresAt };
}

export function createHqClient(auth: HqAuth): HqClient {
  function authHeader(): Record<string, string> {
    const t = auth.getToken();
    if (!t) throw new HqAuthRequiredError();
    return { Authorization: `Bearer ${t}` };
  }

  async function createSession(profile?: InvestorProfile): Promise<string> {
    const t0 = performance.now();
    const url = `${HQ_BASE}/agent/sessions`;
    console.info("[hq-api] createSession → POST", url);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ profile }),
      });
    } catch (err) {
      console.error("[hq-api] createSession fetch threw", err);
      throw err;
    }
    const dt = Math.round(performance.now() - t0);
    console.info("[hq-api] createSession ← status", res.status, `${dt}ms`);
    if (res.status === 401) throw new HqUnauthorizedError();
    if (!res.ok) {
      const body = await res.text().catch(() => "<unreadable>");
      console.error("[hq-api] createSession non-2xx body", body);
      throw new Error(`HQ createSession failed: ${res.status}`);
    }
    const json = (await res.json()) as { data?: { sessionId?: string } };
    const sessionId = json.data?.sessionId;
    if (!sessionId) throw new Error("HQ createSession returned no sessionId");
    return sessionId;
  }

  async function* chatStream(
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
    if (res.status === 401) throw new HqUnauthorizedError();
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

  async function submitToolResult(
    sessionId: string,
    toolCallId: string,
    result: {
      status: "success" | "error";
      code?: string;
      message?: string;
      data?: unknown;
    },
  ): Promise<void> {
    await fetch(`${HQ_BASE}/agent/tool-result`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ sessionId, toolCallId, result }),
    }).catch((err: unknown) => {
      console.warn("[hq-api] submitToolResult failed", err);
    });
  }

  return { createSession, chatStream, submitToolResult };
}

function parseSseFrame(raw: string): ChatEvent | null {
  let event = "";
  const dataLines: string[] = [];
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

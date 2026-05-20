import type { ApiResponse } from "@seabw/core";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export interface HttpOptions {
  url: string;
  method?: "GET" | "POST" | "DELETE" | "PUT";
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function http<T>(opts: HttpOptions): Promise<T> {
  const res = await fetch(`${BASE}${opts.url}`, {
    method: opts.method ?? "GET",
    headers: { "Content-Type": "application/json", ...opts.headers },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  if (!res.ok) {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("json")) {
      try {
        const env = (await res.json()) as ApiResponse<never> | { error?: string };
        if ("ok" in (env as ApiResponse<never>) && (env as ApiResponse<never>).ok === false) {
          throw new Error((env as { ok: false; error: { message: string } }).error.message);
        }
        if ((env as { error?: string }).error) {
          throw new Error((env as { error: string }).error);
        }
      } catch (parseErr) {
        if (parseErr instanceof Error) throw parseErr;
      }
    }
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export function urlWithQuery(path: string, params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    search.set(k, String(v));
  }
  const q = search.toString();
  return q ? `${path}?${q}` : path;
}

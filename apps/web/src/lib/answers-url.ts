import { AnswersSchema, type Answers } from "@/domains/survey/lib";

function toBase64Url(input: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(input, "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string | null {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    if (typeof window === "undefined") {
      return Buffer.from(padded, "base64").toString("utf-8");
    }
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodeAnswers(answers: Answers): string {
  return toBase64Url(JSON.stringify(answers));
}

export function decodeAnswers(encoded: string): Answers | null {
  const json = fromBase64Url(encoded);
  if (json === null) return null;
  try {
    const parsed = JSON.parse(json);
    const result = AnswersSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

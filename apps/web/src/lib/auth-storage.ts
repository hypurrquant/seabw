import { z } from "zod";

const STORAGE_KEY = "defipilot:auth:v1";

const StoredAuthSchema = z.object({
  address: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/) as unknown as z.ZodType<`0x${string}`>,
  token: z.string().min(1),
  expiresAt: z.number().int().positive(),
});

export type StoredAuth = z.infer<typeof StoredAuthSchema>;

export function loadAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = StoredAuthSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.warn("[auth-storage] invalid payload, clearing");
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (parsed.data.expiresAt <= Date.now()) {
      console.info("[auth-storage] expired token, clearing");
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.data;
  } catch (err) {
    console.warn("[auth-storage] load error", err);
    return null;
  }
}

export function saveAuth(data: StoredAuth): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("[auth-storage] save error", err);
  }
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("[auth-storage] clear error", err);
  }
}

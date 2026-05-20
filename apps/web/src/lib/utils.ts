import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value < 0.01) return "<$0.01";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatPct(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function truncateAddress(addr: string, head = 6, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function shortHash(hash?: string): string {
  if (!hash) return "";
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

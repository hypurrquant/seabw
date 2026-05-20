import type { Request } from "express";

export function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0]!.split(",")[0].trim();
  const real = req.headers["x-real-ip"];
  if (typeof real === "string") return real;
  return req.ip ?? "unknown";
}

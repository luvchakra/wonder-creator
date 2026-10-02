import type { NextRequest } from "next/server";

/**
 * The caller's address for rate limiting: the platform's own header first (Vercel sets it and clients can't), then
 * the first hop of X-Forwarded-For. Never trusted for anything but throttling and coarse security history.
 */
export function clientIp(req: NextRequest): string {
  const platform = req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("x-real-ip");
  if (platform) return platform.split(",")[0]!.trim();
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
}

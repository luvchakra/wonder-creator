import "server-only";
import type { NextRequest } from "next/server";

/** A coarse, human description of where a request came from: browser and OS, and a partly hidden network address. */
export function describeRequest(req: NextRequest): { device: string; network: string | null } {
  const ua = req.headers.get("user-agent") ?? "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "A browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const network = /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip.replace(/\.\d+$/, ".x") : ip.includes(":") ? `${ip.split(":").slice(0, 3).join(":")}:…` : null;
  return { device: os ? `${browser} on ${os}` : browser, network };
}

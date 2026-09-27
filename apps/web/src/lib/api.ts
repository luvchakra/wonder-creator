import "server-only";
import { randomUUID } from "node:crypto";
import { DomainError, isDomainError, log, publishEvent } from "@wonder/core";
import { createSharedRateLimiter } from "@wonder/core/server";
import type { Db } from "@wonder/db";
import { indexStaleSubjects, selectProvider } from "@wonder/creator-brain";
import { after, NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { createClient } from "./supabase/server";
import { serviceClient, serviceConfigured } from "./supabase/service";

export interface ApiContext {
  db: Db;
  userId: string;
  creatorId: string;
  requestId: string;
  req: NextRequest;
}

let rateLimitDb: Db | null | undefined;
/** Shared across instances via Postgres when the service key is configured; per-instance otherwise. */
const limiter = createSharedRateLimiter(() => (rateLimitDb ??= serviceConfigured() ? serviceClient() : null));

/** An extra, named budget inside a handler — e.g. cost-bearing image generation starts vs cheap lookups. */
export async function checkBudget(key: string, limit: number, windowMs = 60 * 60_000) {
  await limiter.check(key, limit, windowMs);
}

export interface ApiOptions {
  /** Requests per minute per user for this route (defaults: 120 reads, 60 writes). */
  rateLimit?: number;
  /** Allow signed-out callers (ctx.creatorId will be ""). */
  public?: boolean;
  /** After a successful response, refresh semantic-search embeddings for the caller's changed content. */
  reindex?: boolean;
}

function problem(status: number, code: string, message: string, requestId: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, details, requestId } }, { status, headers: { "x-request-id": requestId, "cache-control": "no-store" } });
}

/**
 * Every API route follows: authentication → creator resolution → rate limit → validation
 * → business operation (domain service, RLS-scoped) → audit/event → response.
 * Route handlers are public endpoints; authorization never relies on the UI.
 */
export function withApi<P = Record<string, string>>(
  handler: (ctx: ApiContext, params: P) => Promise<Response | unknown>,
  opts: ApiOptions = {},
) {
  return async (req: NextRequest, route: { params: Promise<P> }) => {
    const requestId = req.headers.get("x-request-id")?.slice(0, 64) || randomUUID();
    const started = Date.now();
    try {
      // Cross-site request protection for cookie-authenticated mutations.
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.get("origin");
        if (origin && new URL(origin).host !== req.headers.get("host")) {
          throw new DomainError("forbidden", "Cross-site requests are not allowed.");
        }
      }
      const db = await createClient();
      const { data: claims } = await db.auth.getClaims();
      const userId = (claims?.claims?.sub as string | undefined) ?? "";
      if (!userId && !opts.public) throw new DomainError("unauthenticated", "Please sign in to continue.");
      let creatorId = "";
      if (userId) {
        const { data } = await db.from("creators").select("id").eq("user_id", userId).maybeSingle();
        if (!data && !opts.public) throw new DomainError("unauthenticated", "Please sign in to continue.");
        creatorId = data?.id ?? "";
      }
      const limit = opts.rateLimit ?? (req.method === "GET" ? 120 : 60);
      await limiter.check(`${userId || req.headers.get("x-forwarded-for") || "anon"}:${req.nextUrl.pathname}:${req.method}`, limit, 60_000);

      const params = (await route.params) ?? ({} as P);
      const result = await handler({ db, userId, creatorId, requestId, req }, params);
      log("info", "api.ok", { requestId, route: req.nextUrl.pathname, method: req.method, ms: Date.now() - started });
      if (opts.reindex && creatorId && serviceConfigured()) {
        after(() =>
          indexStaleSubjects(serviceClient(), selectProvider(), { creatorId, limit: 10 }).catch((e) =>
            log("warn", "semantic.reindex_failed", { requestId, error: e instanceof Error ? e.message.slice(0, 200) : "unknown" }),
          ),
        );
      }
      if (result instanceof Response) {
        result.headers.set("x-request-id", requestId);
        return result;
      }
      return NextResponse.json(result ?? { ok: true }, { headers: { "x-request-id": requestId, "cache-control": "no-store" } });
    } catch (e) {
      const ms = Date.now() - started;
      if (e instanceof ZodError) {
        const first = e.issues[0];
        return problem(422, "validation", first?.message && !first.message.startsWith("Invalid") ? first.message : "Some details weren't valid.", requestId, e.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
      }
      if (isDomainError(e)) {
        if (e.status >= 500) log("error", "api.error", { requestId, route: req.nextUrl.pathname, code: e.code, ms, cause: String(e.cause ?? "") });
        return problem(e.status, e.code, e.message, requestId);
      }
      log("error", "api.unhandled", { requestId, route: req.nextUrl.pathname, ms, error: e instanceof Error ? e.message : String(e) });
      return problem(500, "internal", "Something went wrong on our side. Nothing you shared was lost.", requestId);
    }
  };
}

export async function readJson(req: NextRequest, maxBytes = 1_000_000): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new DomainError("payload_too_large", "That request is too large.");
  const text = await req.text();
  if (text.length > maxBytes) throw new DomainError("payload_too_large", "That request is too large.");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError("validation", "The request body wasn't valid JSON.");
  }
}

export function requireUuid(v: string | undefined, what = "item"): string {
  if (!v || !/^[0-9a-f-]{36}$/i.test(v)) throw new DomainError("not_found", `We couldn't find that ${what}.`);
  return v;
}

export { publishEvent };

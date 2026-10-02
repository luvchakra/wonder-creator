import { DomainError, fromDbError } from "@wonder/core";
import { PROVIDERS } from "@wonder/creator-sources";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { DIRECT_CONNECT, sourceRows } from "@/lib/sources";

/** GET /api/v1/personal-sources/connections — each source, connected or not, with its last sync and any active job. */
export const GET = withApi(async ({ db }) => ({ sources: await sourceRows(db) }), { feature: "personal_sources_enabled" });

const schema = z.object({ provider: z.enum(PROVIDERS) });

/**
 * POST /api/v1/personal-sources/connections — connect a source that needs no provider consent (Wonder Creator's own
 * notes). Mail and calendar connect through their own consent screens, never here; signing in with Google is not
 * permission to read either (spec §2.11).
 */
export const POST = withApi(
  async ({ db, creatorId, req }) => {
    const { provider } = schema.parse(await readJson(req));
    if (!DIRECT_CONNECT.includes(provider)) throw new DomainError("validation", "This source connects through its own permission screen.");
    const { data, error } = await db.from("source_connections").insert({ creator_id: creatorId, provider }).select("id, provider, status").single();
    if (error?.code === "23505") throw new DomainError("conflict", "That source is already connected.");
    if (error) throw fromDbError(error);
    return Response.json({ connection: data }, { status: 201 });
  },
  { feature: "personal_sources_enabled", rateLimit: 20 },
);

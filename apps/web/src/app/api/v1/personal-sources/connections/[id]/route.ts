import { DomainError, fromDbError } from "@wonder/core";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { connectors } from "@/lib/sources";
import { serviceClient } from "@/lib/supabase/service";

const schema = z.object({ scopeSettings: z.record(z.string(), z.unknown()).optional(), syncMode: z.literal("manual").optional() });

/** PATCH /api/v1/personal-sources/connections/:id — what this source may look at. Sync stays manual (spec §4). */
export const PATCH = withApi<{ id: string }>(
  async ({ db, req }, { id }) => {
    requireUuid(id);
    const b = schema.parse(await readJson(req));
    if (b.scopeSettings && JSON.stringify(b.scopeSettings).length > 4000) throw new DomainError("validation", "Those settings are too large.");
    const patch = { ...(b.scopeSettings ? { scope_settings: b.scopeSettings as never } : {}), ...(b.syncMode ? { sync_mode: b.syncMode } : {}) };
    const { data, error } = await db.from("source_connections").update(patch).eq("id", id).select("id").maybeSingle();
    if (error) throw fromDbError(error);
    if (!data) throw new DomainError("not_found", "We couldn't find that source.");
    return { ok: true };
  },
  { feature: "personal_sources_enabled", rateLimit: 30 },
);

/**
 * DELETE /api/v1/personal-sources/connections/:id — disconnect (spec §11): access stops, the stored credential is
 * destroyed, and everything discovered from this source (index, cursors, runs, suggestions) is deleted. Materials the
 * creator deliberately brought in stay, with their provenance.
 */
export const DELETE = withApi<{ id: string }>(
  async ({ db, creatorId }, { id }) => {
    requireUuid(id);
    const { data: conn } = await db.from("source_connections").select("id, creator_id, provider, status, scope_settings, last_successful_sync_at").eq("id", id).maybeSingle();
    if (!conn) throw new DomainError("not_found", "We couldn't find that source.");
    // Ask the provider to forget the grant too (best effort); the stored credential is destroyed below either way.
    const connector = connectors()[conn.provider as keyof ReturnType<typeof connectors>];
    await connector?.revoke?.({ service: serviceClient(), creatorId, connection: conn as never }).catch(() => undefined);
    const { data: records } = await db.from("source_context_records").select("id").eq("connection_id", id);
    const gone = new Set((records ?? []).map((r) => r.id));
    const { data, error } = await db.from("source_connections").delete().eq("id", id).select("id").maybeSingle();
    if (error) throw fromDbError(error);
    if (!data) throw new DomainError("not_found", "We couldn't find that source.");
    // Suggestions built from this source go too, unless the creator already brought them in.
    if (gone.size) {
      const service = serviceClient();
      const { data: cands } = await service.from("context_candidates").select("id, record_ids").eq("creator_id", creatorId).neq("state", "imported");
      const stale = (cands ?? []).filter((c) => c.record_ids.some((r) => gone.has(r))).map((c) => c.id);
      if (stale.length) await service.from("context_candidates").delete().in("id", stale).eq("creator_id", creatorId);
    }
    return { ok: true };
  },
  { feature: "personal_sources_enabled", rateLimit: 20 },
);

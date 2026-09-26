import { withApi } from "@/lib/api";

/** Data export: everything the creator owns, as JSON (RLS guarantees only their own rows). */
export const GET = withApi(async ({ db, creatorId }) => {
  const tables = [
    "creators", "creator_disciplines", "creator_skills", "creator_languages", "creator_interests", "creator_voice_profiles",
    "creator_boundaries", "creator_autonomy_policies", "creative_materials", "provenance_records", "reference_shelves", "reference_items",
    "material_collections", "conversations", "conversation_messages", "creative_memories", "artifacts", "artifact_versions",
    "lineage_edges", "rights_records", "licenses", "huddle_preserved_items",
  ] as const;
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString() };
  for (const t of tables) {
    const col = t === "creators" ? "id" : "creator_id";
    const { data } = await (db as unknown as import("@supabase/supabase-js").SupabaseClient).from(t).select("*").eq(col, creatorId).limit(10000);
    out[t] = data ?? [];
  }
  return new Response(JSON.stringify(out, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="wonder-creator-export.json"`, "cache-control": "no-store" },
  });
}, { rateLimit: 5 });

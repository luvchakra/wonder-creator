import "server-only";
import { generateContextLine, type ContextFact, type ContextLineInput } from "@wonder/creator-brain";
import { similarMaterials } from "@wonder/creator-library";
import type { Db } from "@wonder/db";
import { log } from "@wonder/core";
import { providerFor } from "./brain";

/**
 * Server side of the Adaptive Context Line (docs/ui-redesign/ai-context-line.md §12–17). Facts come only from the
 * creator's own object on this page, read through their RLS-scoped client — never from the browser — and the model's
 * line is cached per object version so it isn't asked again on every visit. Nothing here is stored as business truth.
 */

export const CONTEXT_LINE_PAGES = ["creation", "studio", "material", "home"] as const;
export type ContextLinePage = (typeof CONTEXT_LINE_PAGES)[number];

const TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { at: number; text: string | null }>();

function remember(key: string, text: string | null) {
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), text });
}

const untrusted = (s: string | null | undefined): ContextFact | null => (s?.trim() ? { untrusted: s.trim().slice(0, 200) } : null);
const clean = (facts: Record<string, ContextFact | null | undefined>) =>
  Object.fromEntries(Object.entries(facts).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && !v.length))) as Record<string, ContextFact>;

/** What the page already knows, as facts for the model plus a cache signature. Null when there's nothing of the creator's own here. */
async function build(db: Db, creatorId: string, page: ContextLinePage, id: string | null): Promise<{ input: ContextLineInput; signature: string } | null> {
  if (page === "creation" || page === "studio" || page === "home") {
    const q = db.from("artifacts").select("id, title, status, creator_id, updated_at, current_version_id").eq("creator_id", creatorId);
    const { data: a } = page === "home" ? await q.in("status", ["draft", "in_review"]).order("updated_at", { ascending: false }).limit(1).maybeSingle() : await q.eq("id", id ?? "").maybeSingle();
    if (!a) return null;
    const [versions, edges, recent] = await Promise.all([
      db.from("artifact_versions").select("version_number, label, change_summary").eq("artifact_id", a.id).order("version_number", { ascending: false }).limit(2),
      db.from("lineage_edges").select("source_id").eq("target_type", "artifact").eq("target_id", a.id).eq("source_type", "material"),
      db.from("creative_materials").select("id, title, type").eq("creator_id", creatorId).order("created_at", { ascending: false }).limit(12),
    ]);
    const linked = new Set((edges.data ?? []).map((e) => e.source_id));
    const unused = (recent.data ?? []).filter((m) => !linked.has(m.id) && m.title?.trim()).slice(0, 4);
    const [cur, prev] = versions.data ?? [];
    const facts = clean({
      version: cur?.version_number ?? null,
      latest_change: untrusted(cur?.change_summary ?? (cur && cur.label !== "Draft" ? cur.label : null)),
      previous_change: untrusted(prev?.change_summary),
      materials_used: linked.size,
      recent_unused_materials: unused.map((m) => ({ untrusted: `${m.title} (${m.type})` })),
      creation_title: page === "home" ? untrusted(a.title) : null,
    });
    return { input: { page, lifecycle: a.status, title: page === "home" ? null : a.title, facts }, signature: `${a.id}:${a.updated_at}:${[...linked].length}:${unused.map((m) => m.id).join(",")}` };
  }
  if (page === "material" && id) {
    const { data: m } = await db.from("creative_materials").select("id, title, type, understanding, updated_at, creator_id").eq("id", id).eq("creator_id", creatorId).maybeSingle();
    if (!m) return null;
    const u = (m.understanding ?? {}) as { summary?: string; themes?: string[] };
    const [used, similar] = await Promise.all([db.from("lineage_edges").select("target_id", { count: "exact", head: true }).eq("source_type", "material").eq("source_id", id).eq("target_type", "artifact"), similarMaterials(db, id, 3).catch(() => [])]);
    const facts = clean({
      material_type: m.type,
      summary: untrusted(u.summary),
      themes: (u.themes ?? []).slice(0, 5).map((t) => ({ untrusted: t })),
      used_in_creations: used.count ?? 0,
      similar_materials: similar.filter((s) => s.title?.trim()).map((s) => ({ untrusted: `${s.title} (${s.type})` })),
    });
    return { input: { page, title: m.title, facts }, signature: `${m.id}:${m.updated_at}:${used.count ?? 0}` };
  }
  return null;
}

/** One semantic line for this page, or null (no live provider, nothing useful, or it failed validation). */
export async function contextLineFor(db: Db, creatorId: string, page: ContextLinePage, id: string | null): Promise<string | null> {
  const built = await build(db, creatorId, page, id);
  if (!built) return null;
  const key = `${creatorId}:${page}:${built.signature}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.text;
  const { provider } = await providerFor(creatorId);
  if (!provider.live) return null;
  try {
    const text = await generateContextLine(provider, built.input);
    remember(key, text);
    return text;
  } catch {
    // The deterministic line stays; a failing provider never breaks the navbar.
    log("warn", "context_line.failed", { page });
    remember(key, null);
    return null;
  }
}

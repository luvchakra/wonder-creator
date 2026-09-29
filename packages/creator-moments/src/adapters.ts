import { fromDbError } from "@wonder/core";
import type { Db } from "@wonder/db";
import type { LiveMomentType, MomentPreviewKind } from "./shared";

/**
 * One adapter per owning domain (§6): the Moment service knows nothing about Materials or Creations beyond what these
 * return. `load` runs as the caller, so its RLS decides what exists for them; anything missing is gone or no longer
 * theirs to see.
 */
export interface MomentPreview {
  creatorId: string;
  occurredAt: string;
  title: string | null;
  excerpt: string | null;
  previewAssetId: string | null;
  previewKind: MomentPreviewKind;
  subtype: string;
}

export interface MomentAdapter {
  load(db: Db, ids: string[]): Promise<Map<string, MomentPreview>>;
}

const kindOfMaterial = (t: string): MomentPreviewKind => (t === "image" || t === "sketch" ? "image" : t === "audio" || t === "voice" ? "audio" : t === "video" ? "video" : "text");

export const MaterialMomentAdapter: MomentAdapter = {
  async load(db, ids) {
    const out = new Map<string, MomentPreview>();
    if (!ids.length) return out;
    const { data, error } = await db.from("creative_materials").select("id, creator_id, type, title, text_content, storage_object_id, created_at").in("id", ids);
    if (error) throw fromDbError(error);
    for (const m of data ?? [])
      out.set(m.id, {
        creatorId: m.creator_id,
        occurredAt: m.created_at,
        title: m.title?.slice(0, 200) ?? null,
        excerpt: m.text_content?.slice(0, 280) ?? null,
        previewAssetId: m.storage_object_id,
        previewKind: kindOfMaterial(m.type),
        subtype: m.type,
      });
    return out;
  },
};

export const CreationMomentAdapter: MomentAdapter = {
  async load(db, ids) {
    const out = new Map<string, MomentPreview>();
    if (!ids.length) return out;
    const { data, error } = await db.from("artifacts").select("id, creator_id, artifact_type, title, description, cover_material_id, created_at").in("id", ids);
    if (error) throw fromDbError(error);
    const covers = [...new Set((data ?? []).map((a) => a.cover_material_id).filter((x): x is string => !!x))];
    const assetOf = new Map<string, string>();
    if (covers.length) {
      const { data: m } = await db.from("creative_materials").select("id, storage_object_id").in("id", covers);
      for (const x of m ?? []) if (x.storage_object_id) assetOf.set(x.id, x.storage_object_id);
    }
    for (const a of data ?? []) {
      const asset = (a.cover_material_id && assetOf.get(a.cover_material_id)) || null;
      out.set(a.id, {
        creatorId: a.creator_id,
        occurredAt: a.created_at,
        title: a.title,
        excerpt: a.description?.slice(0, 280) ?? null,
        previewAssetId: asset,
        previewKind: asset ? "image" : "text",
        subtype: a.artifact_type,
      });
    }
    return out;
  },
};

/** Open Conversations (Phase 03): the caller's view of the conversation; the owner stays the owner. */
export const ConversationMomentAdapter: MomentAdapter = {
  async load(db, ids) {
    const out = new Map<string, MomentPreview>();
    if (!ids.length) return out;
    const { data, error } = await db.from("open_conversations").select("id, creator_id, title, body, intent, created_at, removed_at").in("id", ids);
    if (error) throw fromDbError(error);
    for (const c of data ?? [])
      if (!c.removed_at) out.set(c.id, { creatorId: c.creator_id, occurredAt: c.created_at, title: c.title, excerpt: c.body?.slice(0, 280) ?? null, previewAssetId: null, previewKind: "text", subtype: c.intent });
    return out;
  },
};

/** Scrapbook entries: someone's public thought, referenced — never copied. */
export const ScrapbookMomentAdapter: MomentAdapter = {
  async load(db, ids) {
    const out = new Map<string, MomentPreview>();
    if (!ids.length) return out;
    const { data, error } = await db.from("scrapbook_posts").select("id, creator_id, body, kind, created_at").in("id", ids);
    if (error) throw fromDbError(error);
    for (const p of data ?? [])
      out.set(p.id, { creatorId: p.creator_id, occurredAt: p.created_at, title: p.body.split("\n")[0]?.slice(0, 80) || "Scrapbook", excerpt: p.body.slice(0, 280), previewAssetId: null, previewKind: "text", subtype: p.kind });
    return out;
  },
};

export const MOMENT_ADAPTERS: Record<LiveMomentType, MomentAdapter> = {
  material: MaterialMomentAdapter,
  creation: CreationMomentAdapter,
  conversation: ConversationMomentAdapter,
  scrapbook_entry: ScrapbookMomentAdapter,
};

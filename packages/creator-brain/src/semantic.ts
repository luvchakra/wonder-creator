import { createHash } from "node:crypto";
import { log } from "@wonder/core";
import type { Db } from "@wonder/db";
import type { CreativeModelProvider } from "./providers/types";

export type SubjectType = "material" | "artifact";

interface IndexDoc {
  subjectType: SubjectType;
  subjectId: string;
  creatorId: string;
  title: string | null;
  text: string;
}

const MAX_DOC_CHARS = 20_000;

const hashOf = (model: string, d: IndexDoc) => createHash("sha256").update(`${model}\n${d.title ?? ""}\n${d.text}`).digest("hex");

function understandingText(u: unknown): string {
  if (!u || typeof u !== "object") return "";
  const { summary, themes, moods } = u as { summary?: unknown; themes?: unknown; moods?: unknown };
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").join(", ") : "");
  return [typeof summary === "string" ? summary : "", list(themes), list(moods)].filter(Boolean).join("\n");
}

async function loadDocs(service: Db, subjects: Array<{ subject_type: string; subject_id: string; creator_id: string }>): Promise<IndexDoc[]> {
  const materialIds = subjects.filter((s) => s.subject_type === "material").map((s) => s.subject_id);
  const artifactIds = subjects.filter((s) => s.subject_type === "artifact").map((s) => s.subject_id);
  const docs: IndexDoc[] = [];
  if (materialIds.length) {
    const { data } = await service.from("creative_materials").select("id, creator_id, title, text_content, extracted_text, understanding").in("id", materialIds);
    for (const m of data ?? []) {
      const text = [m.text_content, m.extracted_text, understandingText(m.understanding)].filter(Boolean).join("\n\n").slice(0, MAX_DOC_CHARS);
      if (text || m.title) docs.push({ subjectType: "material", subjectId: m.id, creatorId: m.creator_id, title: m.title, text: text || m.title || "" });
    }
  }
  if (artifactIds.length) {
    const { data } = await service
      .from("artifacts")
      .select("id, creator_id, title, description, artifact_type, current:artifact_versions!artifacts_current_version_fk(content)")
      .in("id", artifactIds);
    for (const a of data ?? []) {
      const current = (Array.isArray(a.current) ? a.current[0] : a.current) as { content: string } | null;
      const text = [a.description, current?.content].filter(Boolean).join("\n\n").slice(0, MAX_DOC_CHARS);
      docs.push({ subjectType: "artifact", subjectId: a.id, creatorId: a.creator_id, title: a.title, text: text || a.title });
    }
  }
  return docs;
}

/**
 * Embed materials/artifacts whose embedding is missing or older than the subject. Pipeline-owned:
 * `service` is the service-role client and every row is written for the subject's own creator.
 * Content that hasn't changed is only re-stamped, not re-embedded. Returns how many were embedded.
 */
export async function indexStaleSubjects(service: Db, provider: CreativeModelProvider, opts: { creatorId?: string; limit?: number } = {}): Promise<number> {
  if (!provider.live || !provider.embed) return 0;
  const { data: stale, error } = await service.rpc("stale_search_subjects", { p_creator: opts.creatorId, p_limit: opts.limit ?? 25 });
  if (error) {
    log("warn", "semantic.stale_query_failed", { code: error.code });
    return 0;
  }
  if (!stale?.length) return 0;

  const docs = await loadDocs(service, stale);
  const { data: existing } = await service
    .from("search_embeddings")
    .select("subject_type, subject_id, content_hash, model")
    .in("subject_id", docs.map((d) => d.subjectId));
  const known = new Map((existing ?? []).map((e) => [`${e.subject_type}:${e.subject_id}`, e]));

  const now = new Date().toISOString();
  const toEmbed: Array<{ doc: IndexDoc; hash: string }> = [];
  for (const doc of docs) {
    const prev = known.get(`${doc.subjectType}:${doc.subjectId}`);
    const hash = prev ? hashOf(prev.model, doc) : "";
    if (prev && prev.content_hash === hash) {
      await service.from("search_embeddings").update({ updated_at: now }).eq("subject_type", doc.subjectType).eq("subject_id", doc.subjectId);
    } else {
      toEmbed.push({ doc, hash });
    }
  }
  if (!toEmbed.length) return 0;

  const out = await provider.embed({ purpose: "document", items: toEmbed.map(({ doc }) => ({ title: doc.title, text: doc.text })) });
  const rows = toEmbed.map(({ doc }, i) => ({
    subject_type: doc.subjectType,
    subject_id: doc.subjectId,
    creator_id: doc.creatorId,
    model: out.model,
    content_hash: hashOf(out.model, doc),
    embedding: JSON.stringify(out.vectors[i]),
    updated_at: now,
  }));
  const { error: upsertError } = await service.from("search_embeddings").upsert(rows, { onConflict: "subject_type,subject_id" });
  if (upsertError) {
    log("warn", "semantic.upsert_failed", { code: upsertError.code });
    return 0;
  }
  return rows.length;
}

export interface SemanticMatch {
  subjectType: SubjectType;
  subjectId: string;
  similarity: number;
}

/**
 * The caller's own materials/artifacts semantically close to `query`. Runs through the caller's
 * RLS-scoped client; returns [] when the provider can't embed or anything fails (search stays lexical).
 */
export async function semanticMatches(db: Db, provider: CreativeModelProvider, query: string, opts: { limit?: number; minSimilarity?: number } = {}): Promise<SemanticMatch[]> {
  if (!provider.live || !provider.embed || query.trim().length < 3) return [];
  try {
    const out = await provider.embed({ purpose: "query", items: [{ text: query }] });
    const { data, error } = await db.rpc("semantic_search", {
      p_query: JSON.stringify(out.vectors[0]),
      p_limit: opts.limit ?? 8,
      p_min_similarity: opts.minSimilarity ?? 0.5,
    });
    if (error) throw error;
    return (data ?? []).map((r) => ({ subjectType: r.subject_type as SubjectType, subjectId: r.subject_id, similarity: r.similarity }));
  } catch (e) {
    log("warn", "semantic.search_failed", { error: e instanceof Error ? e.message.slice(0, 200) : "unknown" });
    return [];
  }
}

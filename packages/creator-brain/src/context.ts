import { allowedInContext, fromDbError, type ContextPurpose, type PrivacyClass } from "@wonder/core";
import type { Db } from "@wonder/db";
import type { Intent } from "./schemas";

export interface MaterialContext {
  ref: string; // short stable ref used in prompts (m1, m2…), never a DB id
  id: string;
  type: string;
  title: string;
  text: string;
  sourceUrl: string | null;
  understanding: unknown;
  imageObjectId: string | null;
  mime: string | null;
}

export interface ArtifactContext {
  ref: string;
  id: string;
  type: string;
  title: string;
  versionId: string | null;
  versionNumber: number | null;
  content: string;
  /** Where it has been published (outcomes only: destination and date). */
  publications: string[];
}

export interface MemoryContext {
  id: string;
  category: string;
  statement: string;
}

export interface CreativeContext {
  creator: { id: string; displayName: string; disciplines: string[]; languages: string[] };
  creativeIdentity: {
    tones: string[];
    writingStyle: string | null;
    formality: string | null;
    narrativeStyle: string | null;
    visualStyles: string[];
    recurringThemes: string[];
    experimentation: string;
    preserve: string[];
    avoid: string[];
    sensitive: string[];
  };
  currentIntent: { intent: Intent; instruction: string; artifactType?: string | null };
  conversation: Array<{ role: "creator" | "brain"; content: string }>;
  selectedMaterials: MaterialContext[];
  selectedArtifacts: ArtifactContext[];
  references: MaterialContext[];
  memories: MemoryContext[];
}

/** Which context blocks each intent needs. Minimization: nothing else is loaded. */
const NEEDS: Record<Intent, { identity: boolean; memories: boolean; conversation: number; references: boolean }> = {
  discover: { identity: true, memories: true, conversation: 4, references: false },
  create: { identity: true, memories: true, conversation: 6, references: true },
  refine: { identity: true, memories: true, conversation: 4, references: false },
  transform: { identity: true, memories: true, conversation: 4, references: true },
  remember: { identity: false, memories: true, conversation: 2, references: false },
  correct_memory: { identity: false, memories: true, conversation: 2, references: false },
  question: { identity: true, memories: true, conversation: 8, references: false },
  chat: { identity: true, memories: false, conversation: 8, references: false },
};

const MAX_MATERIAL_CHARS = 12000;

export interface AssembleOptions {
  purpose?: ContextPurpose;
  intent: Intent;
  instruction: string;
  artifactType?: string | null;
  materialIds?: string[];
  artifactIds?: string[];
  referenceMaterialIds?: string[];
  conversationId?: string | null;
}

async function loadMaterials(db: Db, ids: string[], purpose: ContextPurpose, prefix: string): Promise<MaterialContext[]> {
  if (!ids.length) return [];
  const { data, error } = await db
    .from("creative_materials")
    .select("id, type, title, text_content, extracted_text, source_url, understanding, privacy, security_status, storage_object_id, storage_objects(mime_type)")
    .in("id", ids.slice(0, 12));
  if (error) throw fromDbError(error);
  // Keep caller order; drop anything not permitted for this purpose or not security-cleared.
  const byId = new Map((data ?? []).map((m) => [m.id, m]));
  return ids
    .map((id) => byId.get(id))
    .filter((m): m is NonNullable<typeof m> => !!m && allowedInContext(m.privacy as PrivacyClass, purpose) && m.security_status === "clean")
    .map((m, i) => ({
      ref: `${prefix}${i + 1}`,
      id: m.id,
      type: m.type,
      title: m.title ?? "Untitled",
      text: [m.text_content, m.extracted_text].filter(Boolean).join("\n\n").slice(0, MAX_MATERIAL_CHARS),
      sourceUrl: m.source_url,
      understanding: m.understanding,
      imageObjectId: m.type === "image" || m.type === "sketch" ? m.storage_object_id : null,
      mime: (m.storage_objects as { mime_type: string } | null)?.mime_type ?? null,
    }));
}

async function loadArtifacts(db: Db, ids: string[]): Promise<ArtifactContext[]> {
  if (!ids.length) return [];
  const { data, error } = await db
    .from("artifacts")
    .select("id, artifact_type, title, current_version_id, artifact_versions!artifacts_current_version_fk(id, version_number, content)")
    .in("id", ids.slice(0, 4));
  if (error) throw fromDbError(error);
  // Publication outcomes are part of a piece's context (never pending drafts or copy).
  const { data: pubs } = await db.from("publications").select("artifact_id, destination_name, published_at").in("artifact_id", (data ?? []).map((a) => a.id)).eq("status", "published").order("published_at", { ascending: false }).limit(20);
  return (data ?? []).map((a, i) => {
    const v = a.artifact_versions as unknown as { id: string; version_number: number; content: string } | null;
    const publications = (pubs ?? []).filter((p) => p.artifact_id === a.id).map((p) => `${p.destination_name}, ${p.published_at?.slice(0, 10) ?? ""}`);
    return { ref: `a${i + 1}`, id: a.id, type: a.artifact_type, title: a.title, versionId: v?.id ?? null, versionNumber: v?.version_number ?? null, content: (v?.content ?? "").slice(0, 60000), publications };
  });
}

function keywords(text: string): string[] {
  const stop = new Set(["the", "and", "for", "with", "this", "that", "into", "make", "from", "about", "turn", "these", "those", "some", "want", "what", "should", "become", "please", "create", "write", "more", "less", "my", "me", "it", "a", "an", "of", "to", "in", "on", "i"]);
  return [...new Set(text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !stop.has(w)))].slice(0, 8);
}

async function loadMemories(db: Db, instruction: string, intent: Intent): Promise<MemoryContext[]> {
  // Voice/style memories are always relevant to creative work; other memories only when they match the request.
  const base = await db
    .from("creative_memories")
    .select("id, category, statement")
    .eq("status", "active")
    .in("category", ["creative_voice", "style_preference", "creative_preference"])
    .order("confidence", { ascending: false })
    .limit(intent === "chat" ? 0 : 6);
  if (base.error) throw fromDbError(base.error);
  const kws = keywords(instruction);
  let matched: MemoryContext[] = [];
  if (kws.length) {
    const m = await db
      .from("creative_memories")
      .select("id, category, statement")
      .eq("status", "active")
      .textSearch("search", kws.map((k) => `${k}:*`).join(" | "), { config: "simple" })
      .limit(6);
    if (m.error) throw fromDbError(m.error);
    matched = m.data ?? [];
  }
  const all = new Map<string, MemoryContext>();
  for (const x of [...(base.data ?? []), ...matched]) all.set(x.id, x);
  const list = [...all.values()].slice(0, 10);
  if (list.length) {
    await db.from("creative_memories").update({ last_used_at: new Date().toISOString() }).in("id", list.map((m) => m.id));
  }
  return list;
}

export async function assembleContext(db: Db, creatorId: string, opts: AssembleOptions): Promise<CreativeContext> {
  const needs = NEEDS[opts.intent];
  const purpose = opts.purpose ?? "own_creation";

  const creatorQ = db.from("creators").select("id, display_name").eq("id", creatorId).single();
  const disciplinesQ = db.from("creator_disciplines").select("value").eq("creator_id", creatorId).order("position");
  const languagesQ = db.from("creator_languages").select("value").eq("creator_id", creatorId).order("position");
  const voiceQ = needs.identity ? db.from("creator_voice_profiles").select("*").eq("creator_id", creatorId).maybeSingle() : null;
  const boundariesQ = needs.identity ? db.from("creator_boundaries").select("kind, label").eq("creator_id", creatorId) : null;

  const [creator, disciplines, languages, voice, boundaries] = await Promise.all([creatorQ, disciplinesQ, languagesQ, voiceQ, boundariesQ]);
  if (creator.error) throw fromDbError(creator.error);

  const [selectedMaterials, selectedArtifacts, references, memories] = await Promise.all([
    loadMaterials(db, opts.materialIds ?? [], purpose, "m"),
    loadArtifacts(db, opts.artifactIds ?? []),
    needs.references ? loadMaterials(db, opts.referenceMaterialIds ?? [], purpose, "r") : Promise.resolve([]),
    needs.memories && purpose === "own_creation" ? loadMemories(db, opts.instruction, opts.intent) : Promise.resolve([]),
  ]);

  let conversation: CreativeContext["conversation"] = [];
  if (opts.conversationId && needs.conversation > 0) {
    const { data } = await db
      .from("conversation_messages")
      .select("role, content, kind")
      .eq("conversation_id", opts.conversationId)
      .in("kind", ["text", "question", "understanding"])
      .order("created_at", { ascending: false })
      .limit(needs.conversation);
    conversation = (data ?? []).reverse().map((m) => ({ role: m.role as "creator" | "brain", content: m.content.slice(0, 4000) }));
  }

  const v = voice?.data;
  const b = boundaries?.data ?? [];
  return {
    creator: {
      id: creatorId,
      displayName: creator.data.display_name,
      disciplines: (disciplines.data ?? []).map((d) => d.value),
      languages: (languages.data ?? []).map((l) => l.value),
    },
    creativeIdentity: {
      tones: v?.tones ?? [],
      writingStyle: v?.writing_style ?? null,
      formality: v?.formality ?? null,
      narrativeStyle: v?.narrative_style ?? null,
      visualStyles: v?.visual_styles ?? [],
      recurringThemes: v?.recurring_themes ?? [],
      experimentation: v?.experimentation ?? "balanced",
      preserve: b.filter((x) => x.kind === "preserve").map((x) => x.label),
      avoid: b.filter((x) => x.kind === "avoid").map((x) => x.label),
      sensitive: b.filter((x) => x.kind === "sensitive").map((x) => x.label),
    },
    currentIntent: { intent: opts.intent, instruction: opts.instruction, artifactType: opts.artifactType },
    conversation,
    selectedMaterials,
    selectedArtifacts,
    references,
    memories,
  };
}

export { keywords as extractKeywords };

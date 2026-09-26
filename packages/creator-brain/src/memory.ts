import { DomainError, fromDbError, must, publishEvent } from "@wonder/core";
import type { Db, Enums, Tables } from "@wonder/db";
import { z } from "zod";
import type { CreativeModelProvider } from "./providers/types";
import { memoriesSchema } from "./schemas";

export type Memory = Tables<"creative_memories">;
export type MemoryCategory = Enums<"memory_category">;

/** UI groupings (human language, never "vector memory"). */
export const MEMORY_GROUPS: Array<{ key: string; label: string; categories: MemoryCategory[] }> = [
  { key: "about", label: "About Me", categories: ["creative_fact"] },
  { key: "preferences", label: "Creative Preferences", categories: ["creative_preference", "style_preference", "creative_voice"] },
  { key: "past", label: "Past Work", categories: ["creative_history", "project_context"] },
  { key: "themes", label: "Key Themes", categories: ["recurring_theme"] },
  { key: "people", label: "People", categories: ["relationship_context"] },
];

export const CATEGORY_LABEL: Record<MemoryCategory, string> = {
  creative_preference: "Preference",
  creative_voice: "Voice",
  style_preference: "Style",
  creative_fact: "Fact",
  creative_history: "Creative history",
  relationship_context: "People",
  project_context: "Project",
  recurring_theme: "Theme",
};

export const memoryInputSchema = z.object({
  category: z.enum(["creative_preference", "creative_voice", "style_preference", "creative_fact", "creative_history", "relationship_context", "project_context", "recurring_theme"]),
  statement: z.string().trim().min(3, "Say a little more.").max(500),
});

export async function listMemories(db: Db, opts: { includeRemoved?: boolean } = {}): Promise<Memory[]> {
  let q = db.from("creative_memories").select("*").order("created_at", { ascending: false }).limit(300);
  if (!opts.includeRemoved) q = q.eq("status", "active");
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  return data ?? [];
}

export async function addMemory(
  db: Db,
  creatorId: string,
  m: { category: MemoryCategory; statement: string; sourceKind: Memory["source_kind"]; sourceId?: string | null; sourceLabel?: string | null; confidence?: number },
): Promise<Memory | null> {
  const statement = m.statement.trim();
  // Avoid near-duplicates of an active memory.
  const dup = await db.from("creative_memories").select("id").eq("status", "active").ilike("statement", statement.replace(/[%_]/g, "")).maybeSingle();
  if (dup.data) return null;
  const row = must(
    await db
      .from("creative_memories")
      .insert({
        creator_id: creatorId,
        category: m.category,
        statement,
        source_kind: m.sourceKind,
        source_id: m.sourceId ?? null,
        source_label: m.sourceLabel?.slice(0, 200) ?? null,
        confidence: m.confidence ?? (m.sourceKind === "creator" || m.sourceKind === "onboarding" ? 1 : 0.7),
      })
      .select("*")
      .single(),
  );
  await publishEvent(db, { type: "CreativeMemoryCreated", aggregate: "memory", aggregateId: row.id, payload: { category: m.category, source: m.sourceKind } });
  return row;
}

export async function editMemory(db: Db, creatorId: string, id: string, raw: unknown) {
  const input = memoryInputSchema.parse(raw);
  const res = await db
    .from("creative_memories")
    .update({ category: input.category, statement: input.statement, source_kind: "creator", confidence: 1 })
    .eq("id", id)
    .eq("status", "active")
    .select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that memory.");
  await db.from("creative_memory_feedback").insert({ memory_id: id, creator_id: creatorId, kind: "correct" });
  await publishEvent(db, { type: "CreativeMemoryUpdated", aggregate: "memory", aggregateId: id });
}

export async function removeMemory(db: Db, creatorId: string, id: string, note?: string) {
  const res = await db.from("creative_memories").update({ status: "removed" }).eq("id", id).eq("status", "active").select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that memory.");
  await db.from("creative_memory_feedback").insert({ memory_id: id, creator_id: creatorId, kind: "remove", note: note?.slice(0, 500) ?? null });
  await publishEvent(db, { type: "CreativeMemoryRemoved", aggregate: "memory", aggregateId: id });
}

/** Deterministic memories from what the creator told us in onboarding. */
export function onboardingMemoryStatements(input: {
  disciplines: string[];
  tones: string[];
  writingStyle: string | null;
  visualStyles: string[];
  preserve: string[];
  avoid: string[];
  languages: string[];
}): Array<{ category: MemoryCategory; statement: string }> {
  const out: Array<{ category: MemoryCategory; statement: string }> = [];
  const join = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
  if (input.disciplines.length) out.push({ category: "creative_fact", statement: `You work across ${join(input.disciplines.map((d) => d.toLowerCase()))}.` });
  if (input.languages.length > 1) out.push({ category: "creative_fact", statement: `You create in ${join(input.languages)}.` });
  if (input.tones.length || input.writingStyle) {
    const bits = [input.tones.length ? `${join(input.tones.map((t) => t.toLowerCase()))} tone` : null, input.writingStyle ? `${input.writingStyle} writing` : null].filter(Boolean);
    out.push({ category: "creative_voice", statement: `You prefer ${bits.join(" and ")}.` });
  }
  if (input.visualStyles.length) out.push({ category: "style_preference", statement: `Your visual style leans ${join(input.visualStyles.map((v) => v.toLowerCase()))}.` });
  if (input.preserve.length) out.push({ category: "creative_preference", statement: `Always preserve: ${join(input.preserve)}.` });
  if (input.avoid.length) out.push({ category: "creative_preference", statement: `Avoid: ${join(input.avoid)}.` });
  return out;
}

/**
 * "That's not how I write." — remove the voice/style memories most likely responsible and keep the
 * creator's own words as the new, highest-confidence memory. Returns what changed so the UI can say so.
 */
export async function applyCorrection(db: Db, creatorId: string, message: string, messageId: string | null) {
  const { data, error } = await db
    .from("creative_memories")
    .select("id, statement, category, source_kind, last_used_at")
    .eq("status", "active")
    .in("category", ["creative_voice", "style_preference", "creative_preference"])
    .neq("source_kind", "creator")
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .limit(2);
  if (error) throw fromDbError(error);
  const removed: string[] = [];
  for (const m of data ?? []) {
    await removeMemory(db, creatorId, m.id, `Creator correction: ${message.slice(0, 200)}`);
    removed.push(m.statement);
  }
  const added = await addMemory(db, creatorId, { category: "creative_voice", statement: `In your words: “${message.trim().slice(0, 300)}”`, sourceKind: "creator", sourceId: messageId, sourceLabel: "Your correction in CreatorTalk" });
  return { removed, added };
}

/** Extract durable memories from the creator's own message (never from imported material). */
export async function extractMemories(provider: CreativeModelProvider, system: string, creatorMessage: string) {
  if (!provider.live || creatorMessage.trim().length < 40) return { memories: [], usage: null };
  const out = await provider.structured({
    task: "memory",
    system,
    schema: memoriesSchema,
    schemaName: "memories",
    messages: [{ role: "user", content: `The creator wrote:\n"""${creatorMessage.slice(0, 4000)}"""` }],
  });
  return { memories: out.value.memories.filter((m) => m.confidence >= 0.6).slice(0, 3), usage: out.usage, model: out.model };
}

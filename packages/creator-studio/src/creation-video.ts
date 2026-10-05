import { DomainError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { addLineage, createVersion, getArtifact, type ArtifactVersion } from "./artifacts";
import { runtimeOf, storyboardOf, storyboardSchema, storyboardText } from "./storyboard-options";

export * from "./storyboard-options";

/**
 * Saving a Video's storyboard (creation-pages.md, step 5): every save is a new immutable version holding the shots and
 * their words as a shot list. RLS decides who may version the Creation; here, a frame that wasn't already in it must be
 * the saver's own picture Material, and it gains a lineage edge so publishing, "Used in" and rights see it. A save made
 * against an older version, or one that changes nothing, is refused.
 */
const saveSchema = z.object({
  storyboard: storyboardSchema,
  label: z.string().trim().max(80).optional(),
  baseVersionId: z.string().uuid().nullable().optional(),
});

export async function saveStoryboard(db: Db, creatorId: string, artifactId: string, raw: unknown): Promise<ArtifactVersion> {
  const input = saveSchema.parse(raw);
  const a = await getArtifact(db, artifactId);
  if (input.baseVersionId !== undefined && (input.baseVersionId ?? null) !== (a.current_version_id ?? null)) {
    throw new DomainError("conflict", "A newer version exists. Refresh to see it before saving this.");
  }
  const sb = input.storyboard;
  if (new Set(sb.shots.map((s) => s.id)).size !== sb.shots.length) throw new DomainError("validation", "Each shot needs its own id.");
  const { data: cur } = a.current_version_id ? await db.from("artifact_versions").select("content, structured_content").eq("id", a.current_version_id).maybeSingle() : { data: null };
  const before = storyboardOf(cur?.structured_content, cur?.content ?? "");
  if (cur?.structured_content && JSON.stringify(before.shots) === JSON.stringify(sb.shots)) throw new DomainError("validation", "Nothing has changed since the last version.");
  const had = new Set(before.shots.map((s) => s.frame).filter((x): x is string => !!x));
  const frames = [...new Set(sb.shots.map((s) => s.frame).filter((x): x is string => !!x))];
  if (frames.length) {
    const { data: mats } = await db.from("creative_materials").select("id, creator_id, type, storage_object_id").in("id", frames);
    const byId = new Map((mats ?? []).map((m) => [m.id, m]));
    for (const id of frames) {
      const m = byId.get(id);
      if (!m || !(m.type === "image" || m.type === "sketch") || !m.storage_object_id) throw new DomainError("validation", "Only pictures can be frames.");
      if (!had.has(id) && m.creator_id !== creatorId) throw new DomainError("forbidden", "You can use only your own pictures.");
    }
  }
  for (const id of frames) if (!had.has(id)) await addLineage(db, creatorId, { type: "material", id, relationship: "contains_material" }, { type: "artifact", id: artifactId });
  const secs = runtimeOf(sb);
  return createVersion(db, artifactId, {
    content: storyboardText(sb),
    label: input.label || "Storyboard",
    authorKind: "creator",
    changeSummary: `${sb.shots.length} ${sb.shots.length === 1 ? "shot" : "shots"}, ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}.`,
    structuredContent: sb as unknown as Record<string, unknown>,
  });
}

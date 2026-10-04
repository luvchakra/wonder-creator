import { DomainError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { addLineage, createVersion, getArtifact, type ArtifactVersion } from "./artifacts";
import { audioSetOf } from "./audio-options";

export * from "./audio-options";

/**
 * Keeping a take on the Audio page (creation-pages.md, step 3): a new immutable version naming the recording (the
 * creator's own voice/audio Material) and carrying the words as they are. RLS decides who may version the Creation;
 * the recording gains a lineage edge so publishing, "Used in" and rights see it. Earlier takes stay as Materials.
 */
const saveSchema = z.object({
  materialId: z.string().uuid(),
  seconds: z.number().min(0).max(6 * 60 * 60).optional(),
  content: z.string().max(500000).default(""),
  baseVersionId: z.string().uuid().nullable().optional(),
});

export async function saveAudioTake(db: Db, creatorId: string, artifactId: string, raw: unknown): Promise<ArtifactVersion> {
  const input = saveSchema.parse(raw);
  const a = await getArtifact(db, artifactId);
  if (input.baseVersionId !== undefined && (input.baseVersionId ?? null) !== (a.current_version_id ?? null)) {
    throw new DomainError("conflict", "A newer version exists. Refresh to see it before keeping this.");
  }
  const { data: m } = await db.from("creative_materials").select("id, creator_id, type, storage_object_id, metadata").eq("id", input.materialId).maybeSingle();
  if (!m || !(m.type === "voice" || m.type === "audio") || !m.storage_object_id) throw new DomainError("validation", "That isn't a recording you can use here.");
  if (m.creator_id !== creatorId) throw new DomainError("forbidden", "You can use only your own recordings.");
  const { data: cur } = a.current_version_id ? await db.from("artifact_versions").select("structured_content").eq("id", a.current_version_id).maybeSingle() : { data: null };
  const before = audioSetOf(cur?.structured_content);
  const meta = (m.metadata ?? {}) as { durationSeconds?: unknown };
  const seconds = input.seconds ?? (typeof meta.durationSeconds === "number" ? meta.durationSeconds : 0);
  if (before.take?.materialId !== input.materialId) await addLineage(db, creatorId, { type: "material", id: input.materialId, relationship: "contains_material" }, { type: "artifact", id: artifactId });
  return createVersion(db, artifactId, {
    content: input.content,
    label: before.take ? "New take" : "First take",
    authorKind: "creator",
    changeSummary: before.take ? "Recorded again on the Audio page; the earlier take is kept as a Material." : "Recorded on the Audio page.",
    structuredContent: { kind: "audio", take: { materialId: input.materialId, seconds } },
  });
}

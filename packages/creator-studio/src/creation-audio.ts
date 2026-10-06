import { DomainError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { addLineage, createVersion, getArtifact, type ArtifactVersion } from "./artifacts";
import { audioSetOf, BED_LEVEL, BED_TEMPO, type AudioBed } from "./audio-options";

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
    // Background music stays chosen; its mix was made with the old take, so it's made again with this one.
    structuredContent: { kind: "audio", take: { materialId: input.materialId, seconds }, ...(before.bed ? { bed: before.bed, mix: null } : {}) },
  });
}

/** What the creator chose for the music; the track's own details come from the library on the server. */
export const musicSchema = z.object({
  bed: z
    .object({
      trackId: z.string().regex(/^[a-z0-9-]{1,80}$/i),
      from: z.number().min(0).max(24 * 3600),
      to: z.number().min(0).max(24 * 3600),
      tempo: z.number().min(BED_TEMPO.min).max(BED_TEMPO.max),
      level: z.number().min(BED_LEVEL.min).max(BED_LEVEL.max),
    })
    .refine((b) => b.to - b.from >= 1, { message: "Keep at least a second of the music.", path: ["to"] })
    .nullable(),
  mixMaterialId: z.string().uuid().nullable().optional(),
  mixSeconds: z.number().min(0).max(6 * 60 * 60).optional(),
  baseVersionId: z.string().uuid().nullable().optional(),
});
export type MusicInput = z.infer<typeof musicSchema>;
export type LibraryTrackInfo = { id: string; title: string; artist: string; license: string; attribution: string | null; duration: number };

/**
 * Background music on the Audio page (owner, 6 Oct 2026): a new version carrying the take as it is, the music as chosen
 * (track details from the library, never the browser) and the mix the creator's device made of the two — their own
 * audio Material, which then plays, is heard in the Room and is what's published. `bed: null` takes the music away.
 */
export async function saveAudioMusic(db: Db, creatorId: string, artifactId: string, raw: unknown, track: (id: string) => LibraryTrackInfo | null): Promise<ArtifactVersion> {
  const input = musicSchema.parse(raw);
  const a = await getArtifact(db, artifactId);
  if (input.baseVersionId !== undefined && (input.baseVersionId ?? null) !== (a.current_version_id ?? null)) {
    throw new DomainError("conflict", "A newer version exists. Refresh to see it before changing the music.");
  }
  const { data: cur } = a.current_version_id ? await db.from("artifact_versions").select("content, structured_content").eq("id", a.current_version_id).maybeSingle() : { data: null };
  const before = audioSetOf(cur?.structured_content);
  if (!before.take) throw new DomainError("validation", "Record a take first — the music goes under it.");
  let bed: AudioBed | null = null;
  if (input.bed) {
    const t = track(input.bed.trackId);
    if (!t) throw new DomainError("validation", "That music isn't in the library.");
    const to = Math.min(input.bed.to, t.duration || input.bed.to);
    if (to - input.bed.from < 1) throw new DomainError("validation", "Keep at least a second of the music.");
    bed = { trackId: t.id, title: t.title, artist: t.artist, license: t.license, attribution: t.attribution, from: input.bed.from, to, tempo: input.bed.tempo, level: input.bed.level };
    if (!input.mixMaterialId) throw new DomainError("validation", "The mix didn't come through. Try again.");
    const { data: m } = await db.from("creative_materials").select("id, creator_id, type, storage_object_id").eq("id", input.mixMaterialId).maybeSingle();
    if (!m || !(m.type === "audio" || m.type === "voice") || !m.storage_object_id) throw new DomainError("validation", "That isn't a mix you can use here.");
    if (m.creator_id !== creatorId) throw new DomainError("forbidden", "You can use only your own mix.");
    await addLineage(db, creatorId, { type: "material", id: m.id, relationship: "contains_material" }, { type: "artifact", id: artifactId });
  }
  const mix = bed && input.mixMaterialId ? { materialId: input.mixMaterialId, seconds: input.mixSeconds ?? before.take.seconds } : null;
  return createVersion(db, artifactId, {
    content: cur?.content ?? "",
    label: bed ? (before.bed ? "Music changed" : "Music added") : "Music taken away",
    authorKind: "creator",
    changeSummary: bed ? `Background music: “${bed.title}” by ${bed.artist} (${Math.round(bed.tempo * 100)}% tempo, trimmed), mixed under the take.` : "The background music was taken away; the take plays on its own.",
    structuredContent: { kind: "audio", take: before.take, ...(bed ? { bed, mix } : {}) },
  });
}

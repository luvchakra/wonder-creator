import { DomainError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { addLineage, createVersion, getArtifact, type ArtifactVersion } from "./artifacts";
import { deckOf, deckSchema, deckText } from "./deck-options";

export * from "./deck-options";

/**
 * Saving a Presentation (creation-pages.md, step 4): every save is a new immutable version holding the deck (its slides,
 * notes, pictures and theme) and its words as text, for search, export and reading. RLS decides who may version the
 * Creation (the owner, or a collaborator with edit access); here, a picture new to the deck must be the saver's own
 * picture Material, and it gains a lineage edge so publishing, "Used in" and rights see it. A save that changes nothing
 * is refused; a save made against an older version is refused, so two people never overwrite each other.
 */
const saveSchema = z.object({
  deck: deckSchema,
  label: z.string().trim().max(80).optional(),
  baseVersionId: z.string().uuid().nullable().optional(),
});

export async function saveDeck(db: Db, creatorId: string, artifactId: string, raw: unknown): Promise<ArtifactVersion> {
  const input = saveSchema.parse(raw);
  const a = await getArtifact(db, artifactId);
  if (input.baseVersionId !== undefined && (input.baseVersionId ?? null) !== (a.current_version_id ?? null)) {
    throw new DomainError("conflict", "A newer version exists. Refresh to see it before saving this.");
  }
  if (new Set(input.deck.slides.map((s) => s.id)).size !== input.deck.slides.length) throw new DomainError("validation", "Each slide needs its own id.");
  const { data: cur } = a.current_version_id ? await db.from("artifact_versions").select("content, structured_content").eq("id", a.current_version_id).maybeSingle() : { data: null };
  const before = deckOf(cur?.structured_content, cur?.content ?? "");
  const same = (x: unknown) => JSON.stringify({ theme: (x as { theme: string }).theme, slides: (x as { slides: unknown[] }).slides });
  if (cur?.structured_content && same(before) === same(input.deck)) throw new DomainError("validation", "Nothing has changed since the last version.");
  const had = new Set(before.slides.map((x) => x.image).filter((x): x is string => !!x));
  const pictures = [...new Set(input.deck.slides.map((x) => x.image).filter((x): x is string => !!x))];
  if (pictures.length) {
    const { data: mats } = await db.from("creative_materials").select("id, creator_id, type, storage_object_id").in("id", pictures);
    const byId = new Map((mats ?? []).map((m) => [m.id, m]));
    for (const id of pictures) {
      const m = byId.get(id);
      if (!m || !(m.type === "image" || m.type === "sketch") || !m.storage_object_id) throw new DomainError("validation", "Only pictures can go on a slide.");
      if (!had.has(id) && m.creator_id !== creatorId) throw new DomainError("forbidden", "You can use only your own pictures.");
    }
  }
  for (const id of pictures) if (!had.has(id)) await addLineage(db, creatorId, { type: "material", id, relationship: "contains_material" }, { type: "artifact", id: artifactId });
  const n = input.deck.slides.length;
  return createVersion(db, artifactId, {
    content: deckText(input.deck),
    label: input.label || "Slides",
    authorKind: "creator",
    changeSummary: `${n} ${n === 1 ? "slide" : "slides"}, ${input.deck.theme === "paper" ? "Editorial Paper" : input.deck.theme === "cinematic" ? "Cinematic Dark" : "Soft Gradient"}.`,
    structuredContent: input.deck,
  });
}

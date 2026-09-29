import { DomainError } from "@wonder/core";
import { newSlideFromMaterial, refineSlideWords, slideImageFromMaterial, splitTextIntoSlides, wordsOnSlide } from "@wonder/creator-brain";
import { canInsert, INSERTING_ACTIONS, isCommunitySource, outputModeOf, RIGHTS_HINT, RIGHTS_LABEL, sourceDetail, updateSource, USAGE_LABEL, workingSetView, type UsageIntent } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";
import { deriveImages } from "@/lib/images";
import { assertUuid, studioSigner } from "@/lib/studio";
import { serviceClient } from "@/lib/supabase/service";

export const maxDuration = 60;

const ACTIONS = ["new_slide", "slide_image", "cover", "slide_words", "split_slides", "refine_slide", "draft_words", "refine_draft", "part", "direction", "visual_ref", "pin"] as const;
const schema = z.object({ slideId: z.string().uuid().nullish(), action: z.enum(ACTIONS).nullish() });

/** How each one-tap action counts as a use of the material (shown on its row; In use from now on). */
const ACTION_INTENT: Record<(typeof ACTIONS)[number], UsageIntent> = {
  new_slide: "visual",
  slide_image: "visual",
  cover: "visual",
  slide_words: "content",
  split_slides: "structure",
  refine_slide: "style",
  draft_words: "content",
  refine_draft: "style",
  part: "quote",
  direction: "constraint",
  visual_ref: "style",
  pin: "constraint",
};

/** Words that only steer (a tone, a shape, a fact) rather than being used as they are. */
const STEERING: UsageIntent[] = ["style", "structure", "mood", "fact", "reference", "constraint", "sound"];

/**
 * POST /api/v1/studio-sessions/:id/sources/:sourceId/apply — make the creator's chosen use of a source happen
 * (owner, 28 Sep 2026: "when I select an option, nothing happens"). The choice itself is saved first (PATCH); this does
 * what it says, never more:
 * - Carousel: a photo "as a slide image" → offered on the slide (Use new / Keep current); words → onto the slide;
 *   a tone / shape / fact / the creator's own note → CreativeMind suggests new words for the slide (Use new / Keep current).
 * - Writing: words → returned for the draft; everything else → `refine`, which the Studio runs with the source.
 * A photo's mood or look on a Carousel can't be applied yet and says so.
 */
export const POST = withApi<{ id: string; sourceId: string }>(
  async ({ db, creatorId, req, requestId }, { id, sourceId }) => {
    assertUuid(id, sourceId);
    const b = schema.parse(await readJson(req));
    const view = await workingSetView(db, id, studioSigner(db));
    const row = view.sources.find((s) => s.id === sourceId);
    if (!row?.available) throw new DomainError("not_found", "That source isn't in your Working Set.");
    const { data: a } = await db.from("artifacts").select("id, title, artifact_type").eq("id", view.artifactId).maybeSingle();
    if (!a) throw new DomainError("not_found", "That Creation isn't available.");
    const intent = row.usageIntent ?? null;
    const use = row.usageNote ?? (intent ? USAGE_LABEL[intent] : "Use it");
    const detail = await sourceDetail(db, sourceId);
    const text = (row.fragment?.text ?? detail.text ?? "").trim();
    const isPhoto = row.sourceType === "material" && (row.mediaType === "image" || row.mediaType === "sketch");
    const carousel = outputModeOf(a.artifact_type) === "carousel";
    // Rights gate (Phase 04 §8): only what may be reused goes into the piece itself; the rest can still steer it. The
    // Working Table hides these actions already — this is the check that counts.
    const mayInsert = canInsert(row.rights);
    const refused = { kind: "kept" as const, message: `${RIGHTS_LABEL[row.rights]}: ${RIGHTS_HINT[row.rights]}` };
    if (row.rights === "restricted") throw new DomainError("forbidden", `${RIGHTS_LABEL.restricted}: ${RIGHTS_HINT.restricted}`);
    if (b.action && INSERTING_ACTIONS.includes(b.action) && !mayInsert) throw new DomainError("forbidden", `${RIGHTS_LABEL[row.rights]}: ${RIGHTS_HINT[row.rights]}`);
    const steerLabel = row.sourceType === "comment" ? "Feedback to apply" : isCommunitySource(row.sourceType) ? "Creative direction" : "Its words and tone";
    const steerInstruction =
      row.sourceType === "comment"
        ? "Apply this feedback to the words."
        : isCommunitySource(row.sourceType) && !mayInsert
          ? "Take this creative direction into account. Don't copy its wording."
          : "Rework these words drawing on the source.";

    // One-tap actions under a material's row (owner board, 29 Sep 2026): do exactly what the button says.
    if (b.action) {
      const act = b.action;
      const done = async () =>
        updateSource(db, sourceId, {
          state: row.state === "pinned" ? "pinned" : "in_use",
          usageIntent: row.sourceType === "comment" || (isCommunitySource(row.sourceType) && !mayInsert) ? "constraint" : ACTION_INTENT[act],
          usageNote: null,
        });
      const service = serviceClient();
      // Steering, not copying (Phase 04 §11): the source shapes what CreativeMind does next; nothing is placed yet.
      if (act === "direction") {
        await updateSource(db, sourceId, { state: row.state === "pinned" ? "pinned" : "in_use", roles: ["creative_direction"], usageIntent: "constraint", usageNote: null });
        return { kind: "kept" as const, message: "It's steering the piece now. Refine to work it in." };
      }
      if (act === "visual_ref") {
        await updateSource(db, sourceId, { state: row.state === "pinned" ? "pinned" : "in_use", roles: ["visual", "style"], usageIntent: "style", usageNote: null });
        return { kind: "kept" as const, message: "A visual reference now — it guides the look and isn't placed in the piece." };
      }
      if (act === "pin") {
        await updateSource(db, sourceId, { state: "pinned", roles: [...new Set([...row.roles, "constraint" as const])].slice(0, 4), usageIntent: "constraint", usageNote: null });
        return { kind: "kept" as const, message: "Pinned. It will be kept to when things change." };
      }
      if (act === "cover") {
        if (!isPhoto) throw new DomainError("validation", "Only a photo can be the cover.");
        const { error } = await db.from("artifacts").update({ cover_material_id: row.sourceId }).eq("id", a.id);
        if (error) throw new DomainError("forbidden", "You can't change this Creation's cover.", { cause: error });
        await done();
        return { kind: "cover" as const, message: `“${row.title}” is the cover now.` };
      }
      if (act === "new_slide" || act === "slide_image") {
        if (!carousel || !isPhoto) throw new DomainError("validation", "That works for photos in a Carousel.");
        if (act === "slide_image" && !b.slideId) throw new DomainError("validation", "Pick a slide first.");
        const r =
          act === "new_slide"
            ? await newSlideFromMaterial({ db, service, creatorId, derive: deriveImages }, a.id, row.sourceId, b.slideId ?? null)
            : await slideImageFromMaterial({ db, service, creatorId, derive: deriveImages }, b.slideId!, row.sourceId);
        await done();
        return act === "new_slide"
          ? { kind: "slide_added" as const, slideId: r.slideId, message: "A new slide with your photo is right after this one." }
          : { kind: "slide_image" as const, slideId: r.slideId, message: "Your photo is on the slide." };
      }
      if (act === "part") {
        await done();
        return { kind: "choose_part" as const };
      }
      if (!text) throw new DomainError("validation", "This material has no words to use yet.");
      if (act === "split_slides") {
        if (!carousel) throw new DomainError("validation", "That works in a Carousel.");
        const r = await splitTextIntoSlides({ db, service, creatorId }, a.id, text, b.slideId ?? null);
        await done();
        return { kind: "slide_words" as const, slideId: r.slideId, message: `Split across ${r.slides} ${r.slides === 1 ? "slide" : "slides"}, from this one on. New slides wait for an image.` };
      }
      if (act === "slide_words" || act === "refine_slide") {
        if (!carousel || !b.slideId) throw new DomainError("validation", "Pick a slide first.");
        const { data: slide } = await db.from("carousel_slides").select("id, display_text, source_text").eq("id", b.slideId).eq("artifact_id", a.id).maybeSingle();
        if (!slide) throw new DomainError("not_found", "That slide isn't available.");
        if (act === "slide_words") {
          await wordsOnSlide(db, slide.id, text);
          await done();
          return { kind: "slide_words" as const, slideId: slide.id, message: "Its words are on the image." };
        }
        const r = await refineSlideWords(await brainDeps(db, creatorId, { correlationId: requestId }), {
          creationTitle: a.title,
          words: slide.display_text || slide.source_text,
          sourceText: slide.source_text,
          instruction: steerInstruction,
          from: { title: row.title, use: steerLabel, text },
        });
        await done();
        return { kind: "slide_proposal" as const, slideId: slide.id, text: r.text, live: r.live };
      }
      if (act === "draft_words") {
        await done();
        return { kind: "draft_words" as const, text };
      }
      // refine_draft
      const { data: art } = await db.from("artifacts").select("current_version_id").eq("id", a.id).maybeSingle();
      const { data: v } = art?.current_version_id ? await db.from("artifact_versions").select("content").eq("id", art.current_version_id).maybeSingle() : { data: null };
      await done();
      if (!v?.content?.trim()) return { kind: "kept" as const, message: "Write a first draft and CreativeMind will work it in when you refine." };
      return { kind: "refine" as const, steering: true };
    }

    if (carousel) {
      if (!b.slideId) throw new DomainError("validation", "Pick a slide first.");
      const { data: slide } = await db.from("carousel_slides").select("id, display_text, source_text").eq("id", b.slideId).eq("artifact_id", a.id).maybeSingle();
      if (!slide) throw new DomainError("not_found", "That slide isn't available.");
      if (!mayInsert && (intent === "visual" || intent === "content" || intent === "quote")) return refused;
      if (isPhoto && (intent === "visual" || intent === "content")) {
        await slideImageFromMaterial({ db, service: serviceClient(), creatorId, derive: deriveImages }, slide.id, row.sourceId);
        return { kind: "slide_image" as const, slideId: slide.id, message: "Your photo is on the slide." };
      }
      if (isPhoto)
        return {
          kind: "kept" as const,
          message: `Saved as “${use}”. A photo's ${intent === "style" ? "look" : "mood"} can't be applied to a slide's image yet — use it as the slide image, or regenerate a slide and describe it.`,
        };
      if (!text) return { kind: "kept" as const, message: `Saved as “${use}”. This source has no words to use yet.` };
      if (intent === "content" || intent === "quote") {
        await wordsOnSlide(db, slide.id, text);
        return { kind: "slide_words" as const, slideId: slide.id, message: "Its words are on the image." };
      }
      const r = await refineSlideWords(await brainDeps(db, creatorId, { correlationId: requestId }), {
        creationTitle: a.title,
        words: slide.display_text || slide.source_text,
        sourceText: slide.source_text,
        instruction: row.usageNote ?? `Rework these words using the source for ${use.toLowerCase()}.`,
        from: { title: row.title, use, text },
      });
      return { kind: "slide_proposal" as const, slideId: slide.id, text: r.text, live: r.live };
    }

    if (isPhoto && !row.usageNote && (intent === "visual" || intent === "reference")) return { kind: "kept" as const, message: `Saved as “${use}”.` };
    if (!mayInsert && (intent === "content" || intent === "quote")) return refused;
    if ((intent === "content" || (intent === "quote" && row.fragment)) && text) return { kind: "draft_words" as const, text };
    if (intent === "quote") return { kind: "choose_part" as const };
    if (!text && !isPhoto) return { kind: "kept" as const, message: `Saved as “${use}”. This source has no words to use yet.` };
    // CreativeMind revises a saved draft; with nothing written yet, the choice waits for one.
    const { data: art } = await db.from("artifacts").select("current_version_id").eq("id", a.id).maybeSingle();
    const { data: v } = art?.current_version_id ? await db.from("artifact_versions").select("content").eq("id", art.current_version_id).maybeSingle() : { data: null };
    if (!v?.content?.trim()) return { kind: "kept" as const, message: `Saved as “${use}”. Write a first draft and CreativeMind will work it in when you refine.` };
    return { kind: "refine" as const, steering: !intent || STEERING.includes(intent) };
  },
  { rateLimit: 30 },
);

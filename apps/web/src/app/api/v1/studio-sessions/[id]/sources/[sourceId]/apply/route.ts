import { DomainError } from "@wonder/core";
import { refineSlideWords, slideImageFromMaterial, updateCarouselSlide } from "@wonder/creator-brain";
import { outputModeOf, sourceDetail, USAGE_LABEL, workingSetView, type UsageIntent } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";
import { deriveImages } from "@/lib/images";
import { assertUuid, studioSigner } from "@/lib/studio";
import { serviceClient } from "@/lib/supabase/service";

export const maxDuration = 60;

const schema = z.object({ slideId: z.string().uuid().nullish() });

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

    if (outputModeOf(a.artifact_type) === "carousel") {
      if (!b.slideId) throw new DomainError("validation", "Pick a slide first.");
      const { data: slide } = await db.from("carousel_slides").select("id, display_text, source_text").eq("id", b.slideId).eq("artifact_id", a.id).maybeSingle();
      if (!slide) throw new DomainError("not_found", "That slide isn't available.");
      if (isPhoto && (intent === "visual" || intent === "content")) {
        await slideImageFromMaterial({ db, service: serviceClient(), creatorId, derive: deriveImages }, slide.id, row.sourceId);
        return { kind: "slide_image" as const, slideId: slide.id, message: "Your photo is on the slide — keep it or the current one." };
      }
      if (isPhoto)
        return {
          kind: "kept" as const,
          message: `Saved as “${use}”. A photo's ${intent === "style" ? "look" : "mood"} can't be applied to a slide's image yet — use it as the slide image, or regenerate a slide and describe it.`,
        };
      if (!text) return { kind: "kept" as const, message: `Saved as “${use}”. This source has no words to use yet.` };
      if (intent === "content" || intent === "quote") {
        await updateCarouselSlide(db, slide.id, { displayText: text.slice(0, 2000) });
        return { kind: "slide_words" as const, slideId: slide.id, message: "Its words are on the slide." };
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

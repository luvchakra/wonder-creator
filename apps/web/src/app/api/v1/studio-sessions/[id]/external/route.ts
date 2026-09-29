import { randomUUID } from "node:crypto";
import { DomainError, isDomainError, log } from "@wonder/core";
import { newSlideFromMaterial } from "@wonder/creator-brain";
import { downloadExternalImage, EXTERNAL_PROVIDERS, EXTERNAL_PROVIDER_LABEL, lookupExternalImage } from "@wonder/creator-library";
import { processIntake, receiveFile } from "@wonder/creator-send";
import { addSources, canInsert, outputModeOf, RIGHTS_HINT, RIGHTS_LABEL, updateSource, workingSetView } from "@wonder/creator-studio";
import { after } from "next/server";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { providerFor } from "@/lib/brain";
import { externalKeys } from "@/lib/external-images";
import { deriveImages } from "@/lib/images";
import { assertUuid, studioSigner } from "@/lib/studio";
import { serviceClient } from "@/lib/supabase/service";

export const maxDuration = 60;

const schema = z.object({
  provider: z.enum(EXTERNAL_PROVIDERS),
  imageId: z.string().min(1).max(64),
  use: z.enum(["table", "slide", "mood"]).default("table"),
  slideId: z.string().uuid().nullish(),
});

/**
 * POST /api/v1/studio-sessions/:id/external — bring a royalty-free picture onto the Working Table (owner board, 29 Sep
 * 2026): "Add to Table", "Use as slide" (Carousel: a new slide after the one on screen) or "Use for mood". The picture is
 * looked up again with the provider (never trusted from the browser), fetched through the SSRF guard, and goes through
 * the same upload checks as anything else; it becomes the creator's Material with its licence, creator and source
 * recorded in provenance, then a Working Set source.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    assertUuid(id);
    const b = schema.parse(await readJson(req));
    const view = await workingSetView(db, id, studioSigner(db));
    const img = await lookupExternalImage(b.provider, b.imageId, externalKeys());
    // Rights gate (Phase 04 §8): a picture whose licence doesn't allow reuse can be a reference, never a slide.
    if (b.use === "slide" && !canInsert(img.rights)) throw new DomainError("forbidden", `${RIGHTS_LABEL[img.rights]}: ${RIGHTS_HINT[img.rights]}`);
    const bytes = await downloadExternalImage(img);
    const deps = { db, service: serviceClient(), creatorId, provider: (await providerFor(creatorId)).provider };
    const item = await receiveFile(deps, {
      batchId: randomUUID(),
      bytes,
      filename: `${
        img.title
          .replace(/[^\p{L}\p{N} _-]+/gu, " ")
          .trim()
          .slice(0, 60) || "picture"
      }.${img.imageUrl.match(/\.(png|webp|gif)(\?|$)/i)?.[1]?.toLowerCase() ?? "jpg"}`,
      external: { provider: EXTERNAL_PROVIDER_LABEL[b.provider], sourceUrl: img.sourceUrl, title: img.title, creator: img.creator, license: img.license, licenseUrl: img.licenseUrl },
    });
    const materialId = item.material_id;
    if (!materialId) throw new DomainError("provider_failed", "Couldn't bring that picture in. Try another.");
    // Understanding (description, tags) continues after the response, like anything brought in.
    after(async () => {
      try {
        await processIntake(deps, item.id);
      } catch (e) {
        log("warn", "external.process_failed", { intakeId: item.id, code: isDomainError(e) ? e.code : "internal" });
      }
    });
    await addSources(db, creatorId, id, [{ type: "material", id: materialId }], b.use === "table" ? "available" : "in_use");
    const fresh = await workingSetView(db, id, studioSigner(db));
    const row = fresh.sources.find((s) => s.sourceType === "material" && s.sourceId === materialId);
    let slideId: string | null = null;
    if (b.use === "slide") {
      const { data: a } = await db.from("artifacts").select("artifact_type").eq("id", view.artifactId).maybeSingle();
      if (outputModeOf(a?.artifact_type ?? "") !== "carousel") throw new DomainError("validation", "Use as slide works in a Carousel.");
      slideId = (await newSlideFromMaterial({ db, service: deps.service, creatorId, derive: deriveImages }, view.artifactId, materialId, b.slideId ?? null)).slideId;
    }
    if (row && b.use !== "table") await updateSource(db, row.id, { usageIntent: b.use === "slide" ? "visual" : "mood", usageNote: null });
    return {
      materialId,
      sourceRowId: row?.id ?? null,
      slideId,
      title: img.title,
      thumbUrl: img.thumbUrl,
      message: `${EXTERNAL_PROVIDER_LABEL[b.provider]} image added${b.use === "slide" ? " as a new slide" : b.use === "mood" ? " for mood" : ""}`,
    };
  },
  { rateLimit: 30 },
);

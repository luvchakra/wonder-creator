import { DomainError } from "@wonder/core";
import { saveTextOverlay } from "@wonder/creator-brain";
import { z } from "zod";
import { withApi } from "@/lib/api";
import { UUID } from "@/lib/carousel-jobs";
import { deriveImages } from "@/lib/images";
import { serviceClient } from "@/lib/supabase/service";

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * POST /api/v1/carousel-slides/:id/material — keep this slide as composed (image + its words, set in the browser) as a
 * derived Material with provenance and lineage (multipart: `file`, `text`).
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    if (!UUID.test(id)) throw new DomainError("not_found", "That slide isn't available.");
    const { data: s } = await db.from("carousel_slides").select("asset_id").eq("id", id).maybeSingle();
    if (!s?.asset_id) throw new DomainError("not_found", "This slide has no image yet.");
    const { data: a } = await db.from("image_generation_assets").select("generation_id").eq("id", s.asset_id).maybeSingle();
    if (!a) throw new DomainError("not_found", "This slide has no image yet.");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new DomainError("validation", "The image didn't arrive. Please try again.");
    if (file.size > MAX_BYTES) throw new DomainError("payload_too_large", "That image is too large to keep.");
    const text = z.string().trim().min(1).max(500).parse(form.get("text"));
    return saveTextOverlay({ db, service: serviceClient(), creatorId, derive: deriveImages }, a.generation_id, s.asset_id, { bytes: new Uint8Array(await file.arrayBuffer()), text, useInCreation: true });
  },
  { rateLimit: 30 },
);

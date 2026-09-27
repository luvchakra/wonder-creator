import { DomainError } from "@wonder/core";
import { saveTextOverlay } from "@wonder/creator-brain";
import { z } from "zod";
import { withApi } from "@/lib/api";
import { deriveImages } from "@/lib/images";
import { serviceClient } from "@/lib/supabase/service";

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * POST /api/v1/image-generations/:id/text — keep a generated image with the creator's words set on it (multipart:
 * `file`, `assetId`, `text`, optional `useInCreation`). The words are composed in the browser; this stores the result
 * as a derived Material with provenance and lineage.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("not_found", "That isn't available.");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new DomainError("validation", "The image didn't arrive. Please try again.");
    if (file.size > MAX_BYTES) throw new DomainError("payload_too_large", "That image is too large to keep.");
    const b = z
      .object({ assetId: z.string().uuid(), text: z.string().trim().min(1).max(500), useInCreation: z.enum(["true", "false"]).optional() })
      .parse({ assetId: form.get("assetId"), text: form.get("text"), useInCreation: form.get("useInCreation") ?? undefined });
    return saveTextOverlay({ db, service: serviceClient(), creatorId, derive: deriveImages }, id, b.assetId, {
      bytes: new Uint8Array(await file.arrayBuffer()),
      text: b.text,
      useInCreation: b.useInCreation === "true",
    });
  },
  { rateLimit: 30 },
);

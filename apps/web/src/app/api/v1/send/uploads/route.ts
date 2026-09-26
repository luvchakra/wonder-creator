import { DomainError } from "@wonder/core";
import { MAX_UPLOAD_BYTES } from "@wonder/core/server";
import { MATERIAL_BUCKET } from "@wonder/creator-library";
import { incomingPath } from "@wonder/creator-send";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/service";

const schema = z.object({ files: z.array(z.object({ name: z.string().max(300), size: z.number().int().positive() })).min(1).max(12) });

/**
 * Signed, single-use upload URLs into the creator's private "incoming" folder, so large files go
 * browser → storage directly. Nothing is registered until /api/v1/send validates the bytes.
 */
export const POST = withApi(async ({ creatorId, req }) => {
  const { files } = schema.parse(await readJson(req));
  const service = serviceClient();
  const out = [];
  for (const f of files) {
    if (f.size > MAX_UPLOAD_BYTES) throw new DomainError("payload_too_large", `“${f.name}” is larger than we can accept right now.`);
    const path = incomingPath(creatorId);
    const { data, error } = await service.storage.from(MATERIAL_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new DomainError("provider_failed", "We couldn't prepare the upload. Please try again.");
    out.push({ name: f.name, path, token: data.token });
  }
  return { uploads: out };
}, { rateLimit: 30 });

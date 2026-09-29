import { DomainError } from "@wonder/core";
import { listSuggestions } from "@wonder/creator-moments";
import { requireUuid, withApi } from "@/lib/api";

/**
 * GET /api/v1/capture/:materialId — how a capture is getting on, for the quiet line under Quick Capture: still
 * working, transcribed, or transcription unavailable (the recording is always kept), plus any DejaVu suggestions.
 */
export const GET = withApi<{ materialId: string }>(async ({ db }, { materialId }) => {
  const id = requireUuid(materialId, "capture");
  const { data: m } = await db.from("creative_materials").select("id, type, processing_state, metadata").eq("id", id).maybeSingle();
  if (!m) throw new DomainError("not_found", "We couldn't find that capture.");
  const meta = (m.metadata ?? {}) as { transcription?: unknown; processingNote?: string };
  const done = m.processing_state === "ready" || m.processing_state === "understood" || m.processing_state === "failed";
  const audio = m.type === "voice" || m.type === "audio";
  const { data: moment } = await db.from("moment_references").select("id").eq("entity_type", "material").eq("entity_id", id).maybeSingle();
  return {
    materialId: id,
    done,
    transcription: !audio ? null : meta.transcription ? "done" : done ? "unavailable" : "pending",
    note: done ? (meta.processingNote ?? null) : null,
    momentId: moment?.id ?? null,
    suggestions: moment ? await listSuggestions(db, moment.id) : [],
  };
});

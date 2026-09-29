import { DomainError, isDomainError, log } from "@wonder/core";
import { MAX_UPLOAD_BYTES } from "@wonder/core/server";
import { suggestDejaVusFromText, suggestNewDejaVu } from "@wonder/creator-moments";
import type { Db } from "@wonder/db";
import { processIntake, receiveFile, receiveText, type IntakeDeps } from "@wonder/creator-send";
import { after } from "next/server";
import { z } from "zod";
import { withApi } from "@/lib/api";
import { providerFor } from "@/lib/brain";
import { serviceClient } from "@/lib/supabase/service";
import { track } from "@/lib/telemetry";
import { flagOn } from "@/lib/features";

export const maxDuration = 120;

const MAX_VOICE_SECONDS = 20 * 60;

/**
 * POST /api/v1/capture — Quick Capture from Home (docs/phases/02-home-quick-capture.md §6).
 *   JSON `{kind: "note", clientId, text}` or multipart `kind=voice, clientId, file, seconds`.
 * Capture first, organise later: the original is saved now (a Material, whose Moment the database makes), and the
 * rest — understanding, transcription, DejaVu suggestions — continues after the response. `clientId` is made on the
 * device when Save is tapped, so a retry (slow upload, a note saved offline and synced later) lands exactly once.
 */
export const POST = withApi(
  async ({ db, creatorId, req }) => {
    const multipart = (req.headers.get("content-type") ?? "").includes("multipart/form-data");
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_UPLOAD_BYTES + 64_000) throw new DomainError("payload_too_large", "That recording is too long to save in one go.");
    let input: { kind: "note"; clientId: string; text: string } | { kind: "voice"; clientId: string; file: File; seconds: number };
    if (multipart) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File) || !file.size) throw new DomainError("validation", "There's no recording to save.");
      input = {
        kind: "voice",
        clientId: z.string().uuid().parse(form.get("clientId")),
        file,
        seconds: Math.min(MAX_VOICE_SECONDS, Math.max(0, Number(form.get("seconds")) || 0)),
      };
    } else {
      const b = z.object({ kind: z.literal("note"), clientId: z.string().uuid(), text: z.string().max(200000) }).parse(await req.json().catch(() => ({})));
      if (!b.text.trim()) throw new DomainError("validation", "Write something first.");
      input = b;
    }

    const service = serviceClient();
    // Exactly once: the receipt is claimed before anything is saved; a retry finds it.
    const claim = await service.from("capture_receipts").insert({ creator_id: creatorId, client_id: input.clientId, kind: input.kind });
    if (claim.error?.code === "23505") {
      const { data } = await db.from("capture_receipts").select("material_id").eq("client_id", input.clientId).maybeSingle();
      return { materialId: data?.material_id ?? null, momentId: data?.material_id ? await momentFor(db, data.material_id) : null, duplicate: true };
    }
    if (claim.error) throw new DomainError("internal", "We couldn't save that. Try again.", { cause: claim.error });

    const deps: IntakeDeps = { db, service, creatorId, provider: (await providerFor(creatorId)).provider };
    let intakeIds: string[] = [];
    let materialId: string | null = null;
    try {
      if (input.kind === "note") {
        const items = await receiveText(deps, { batchId: input.clientId, text: input.text });
        intakeIds = items.map((i) => i.id);
        materialId = items.find((i) => i.material_id)?.material_id ?? null;
      } else {
        const when = new Date().toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
        const ext = input.file.type.includes("mp4") ? "m4a" : input.file.type.includes("ogg") ? "ogg" : "webm";
        const item = await receiveFile(deps, { batchId: input.clientId, bytes: new Uint8Array(await input.file.arrayBuffer()), filename: `Voice note ${when}.${ext}`, kind: "voice" });
        intakeIds = [item.id];
        materialId = item.material_id;
        if (materialId && input.seconds) {
          const { data: m } = await service.from("creative_materials").select("metadata").eq("id", materialId).eq("creator_id", creatorId).single();
          await service
            .from("creative_materials")
            .update({ metadata: { ...((m?.metadata as Record<string, unknown>) ?? {}), durationSeconds: input.seconds } })
            .eq("id", materialId)
            .eq("creator_id", creatorId);
        }
      }
    } catch (e) {
      // Nothing was kept: free the receipt so the same capture can be tried again.
      await service.from("capture_receipts").delete().eq("creator_id", creatorId).eq("client_id", input.clientId);
      throw e;
    }
    await service.from("capture_receipts").update({ material_id: materialId }).eq("creator_id", creatorId).eq("client_id", input.clientId);
    track(input.kind === "note" ? "quick_note_saved" : "voice_note_saved", creatorId, input.kind === "voice" ? { seconds: input.seconds } : {});

    // Understanding and transcription continue in the background (durable through the jobs table); then the words are
    // matched against the creator's DejaVus as *suggestions* only.
    after(async () => {
      for (const id of intakeIds) {
        try {
          await processIntake(deps, id);
          await service.from("jobs").update({ status: "succeeded" }).eq("idempotency_key", `intake:${id}`);
        } catch (e) {
          log("warn", "capture.process_failed", { intakeId: id, code: isDomainError(e) ? e.code : "internal" });
        }
      }
      if (!materialId) return;
      try {
        const { data: m } = await service.from("creative_materials").select("text_content, extracted_text, metadata").eq("id", materialId).eq("creator_id", creatorId).single();
        if (input.kind === "voice" && (m?.metadata as { transcription?: unknown } | null)?.transcription) track("voice_note_transcribed", creatorId, { ok: true });
        const { data: moment } = await service.from("moment_references").select("id").eq("creator_id", creatorId).eq("entity_type", "material").eq("entity_id", materialId).maybeSingle();
        const text = [m?.text_content, m?.extracted_text].filter(Boolean).join("\n");
        if (moment && text) await suggestDejaVusFromText(service, creatorId, moment.id, text);
        // A recurring human theme that isn't a DejaVu yet (Phase 05 §6) — suggested, never created on its own.
        if (moment && flagOn("dejavu_ai_suggestions_enabled")) await suggestNewDejaVu(service, creatorId, moment.id, materialId);
      } catch (e) {
        log("warn", "capture.suggest_failed", { code: isDomainError(e) ? e.code : "internal" });
      }
    });
    return { materialId, momentId: materialId ? await momentFor(db, materialId) : null, duplicate: false };
  },
  { rateLimit: 30 },
);

async function momentFor(db: Db, materialId: string): Promise<string | null> {
  const { data } = await db.from("moment_references").select("id").eq("entity_type", "material").eq("entity_id", materialId).maybeSingle();
  return data?.id ?? null;
}

import { randomUUID } from "node:crypto";
import { DomainError, isDomainError, log } from "@wonder/core";
import { MAX_UPLOAD_BYTES } from "@wonder/core/server";
import { listIntake, processIntake, receiveFile, receiveText, receiveUploadedObject, receiveUrl, type IntakeDeps } from "@wonder/creator-send";
import { after } from "next/server";
import { withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";
import { serviceClient } from "@/lib/supabase/service";

export const maxDuration = 120;

export const GET = withApi(async ({ db, req }) => {
  const batch = req.nextUrl.searchParams.get("batch");
  return { items: await listIntake(db, { batchId: batch && /^[0-9a-f-]{36}$/i.test(batch) ? batch : undefined, limit: 40 }) };
});

/**
 * CreatorSend: bring anything. multipart/form-data with any of:
 *   files[] (images, audio, video, PDFs, documents), kind=camera|voice, text, urls (newline-separated)
 * Originals are validated and stored now; extraction/understanding continue durably in the background.
 */
export const POST = withApi(async ({ db, creatorId, req }) => {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES * 5) throw new DomainError("payload_too_large", "That's too much at once — try sending fewer files.");
  const form = await req.formData();
  const deps: IntakeDeps = { db, service: serviceClient(), creatorId, provider: brainDeps(db, creatorId).provider };
  const batchId = randomUUID();
  const kind = form.get("kind");
  const text = String(form.get("text") ?? "").trim();
  const urls = String(form.get("urls") ?? "")
    .split(/\s+/)
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, 20);
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 12);
  // Files already uploaded directly to storage (signed upload URLs): "path::name" entries.
  const uploaded = form
    .getAll("uploaded")
    .map((v) => String(v))
    .slice(0, 12)
    .map((v) => ({ path: v.split("::")[0], name: v.split("::").slice(1).join("::") || null }));
  if (!text && !urls.length && !files.length && !uploaded.length) throw new DomainError("validation", "Add a note, a file or a link.");

  const accepted: Array<{ id: string; materialId: string | null; state: string }> = [];
  const rejected: Array<{ name: string; message: string }> = [];
  for (const f of files) {
    try {
      const item = await receiveFile(deps, { batchId, bytes: new Uint8Array(await f.arrayBuffer()), filename: f.name, kind: kind === "camera" || kind === "voice" ? kind : null, instruction: text || null });
      accepted.push({ id: item.id, materialId: item.material_id, state: item.state });
    } catch (e) {
      rejected.push({ name: f.name, message: isDomainError(e) ? e.message : "We couldn't accept this file." });
    }
  }
  for (const u of uploaded) {
    try {
      const item = await receiveUploadedObject(deps, { batchId, path: u.path, filename: u.name, kind: kind === "camera" || kind === "voice" ? kind : null, instruction: text || null });
      accepted.push({ id: item.id, materialId: item.material_id, state: item.state });
    } catch (e) {
      rejected.push({ name: u.name ?? "Upload", message: isDomainError(e) ? e.message : "We couldn't accept this file." });
    }
  }
  for (const url of urls) {
    try {
      const item = await receiveUrl(deps, { batchId, url, instruction: text || null });
      accepted.push({ id: item.id, materialId: item.material_id, state: item.state });
    } catch (e) {
      rejected.push({ name: url, message: isDomainError(e) ? e.message : "We couldn't accept this link." });
    }
  }
  if (text && !(files.length || urls.length || uploaded.length)) {
    for (const item of await receiveText(deps, { batchId, text, voice: kind === "voice" })) accepted.push({ id: item.id, materialId: item.material_id, state: item.state });
  }

  // Continue processing after the response; the jobs table makes it durable if this is interrupted.
  after(async () => {
    for (const a of accepted) {
      try {
        await processIntake(deps, a.id);
        await deps.service.from("jobs").update({ status: "succeeded" }).eq("idempotency_key", `intake:${a.id}`);
      } catch (e) {
        log("warn", "send.process_failed", { intakeId: a.id, code: isDomainError(e) ? e.code : "internal" });
      }
    }
  });
  return { batchId, accepted, rejected };
}, { rateLimit: 30 });

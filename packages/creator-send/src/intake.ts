import { randomUUID } from "node:crypto";
import { DomainError, fromDbError, isDomainError, log, must, publishEvent } from "@wonder/core";
import { inspectUpload, parseExternalUrl, safeFetch, safeFilename, type MediaKind } from "@wonder/core/server";
import { indexStaleSubjects, understandMaterial, type CreativeModelProvider } from "@wonder/creator-brain";
import { createMaterial, MATERIAL_BUCKET, type MaterialType } from "@wonder/creator-library";
import type { Db, JsonValue, Tables } from "@wonder/db";
import { extractDocxText } from "./docx";
import { extractPage, parseYouTubeId, splitLinks } from "./links";
import { canTransition, type IntakeState } from "./states";

export type IntakeItem = Tables<"intake_items">;
export type InputKind = IntakeItem["input_kind"];

/**
 * Two clients, deliberately:
 * - `db`: the creator's session (RLS). Creates materials and publishes events as the creator.
 * - `service`: service role, used ONLY for pipeline-owned state (storage objects, intake rows,
 *   scan/processing status) and always scoped by an explicit, server-resolved creatorId.
 */
export interface IntakeDeps {
  db: Db;
  service: Db;
  creatorId: string;
  provider: CreativeModelProvider;
}

const KIND_TO_TYPE: Record<MediaKind, MaterialType> = {
  image: "image",
  audio: "audio",
  video: "video",
  pdf: "pdf",
  document: "document",
  text: "note",
};

async function transition(deps: IntakeDeps, item: IntakeItem, to: IntakeState, patch: Partial<IntakeItem> = {}): Promise<IntakeItem> {
  if (!canTransition(item.state, to)) throw new DomainError("internal", `invalid intake transition ${item.state} -> ${to}`);
  const { data, error } = await deps.service
    .from("intake_items")
    .update({ ...patch, state: to })
    .eq("id", item.id)
    .eq("creator_id", deps.creatorId)
    .eq("state", item.state) // optimistic: never clobber a concurrent transition
    .select("*")
    .single();
  if (error) throw fromDbError(error);
  if (item.material_id) {
    await deps.service.from("creative_materials").update({ processing_state: to }).eq("id", item.material_id).eq("creator_id", deps.creatorId);
  }
  return data;
}

async function newIntake(deps: IntakeDeps, row: { batchId: string; kind: InputKind; sourceUrl?: string | null; instruction?: string | null }): Promise<IntakeItem> {
  return must(
    await deps.service
      .from("intake_items")
      .insert({ creator_id: deps.creatorId, batch_id: row.batchId, input_kind: row.kind, source_url: row.sourceUrl ?? null, instruction: row.instruction ?? null })
      .select("*")
      .single(),
  );
}

async function enqueue(deps: IntakeDeps, intakeId: string) {
  const res = await deps.service.from("jobs").insert({ creator_id: deps.creatorId, kind: "intake.process", subject_id: intakeId, idempotency_key: `intake:${intakeId}` });
  if (res.error && res.error.code !== "23505") throw fromDbError(res.error);
}

// ---------------------------------------------------------------------------
// Receive (fast, in the request): validate, store the original, create the material.
// ---------------------------------------------------------------------------
export async function receiveText(deps: IntakeDeps, input: { batchId: string; text: string; title?: string | null; voice?: boolean }) {
  const text = input.text.trim();
  if (!text) throw new DomainError("validation", "Write something first.");
  if (text.length > 200000) throw new DomainError("payload_too_large", "That's a lot of text — try splitting it into a few notes.");
  const { urls, rest } = splitLinks(text);
  const results: IntakeItem[] = [];
  for (const url of urls) results.push(await receiveUrl(deps, { batchId: input.batchId, url, instruction: rest || null }));
  if (rest && (!urls.length || rest.length > 20)) {
    const item = await newIntake(deps, { batchId: input.batchId, kind: input.voice ? "voice" : "text", instruction: null });
    const material = await createMaterial(deps.db, deps.creatorId, {
      type: rest.length < 280 && !input.voice ? "idea" : "note",
      title: input.title || firstLine(rest),
      textContent: rest,
      sourceType: input.voice ? "voice_transcript" : "typed",
      provenance: { origin: input.voice ? "voice_recording" : "typed" },
    });
    const withMat = must(await deps.service.from("intake_items").update({ material_id: material.id }).eq("id", item.id).select("*").single());
    // Plain text: nothing to scan or extract.
    let cur = await transition(deps, withMat, "validating");
    cur = await transition(deps, cur, "security_review");
    cur = await transition(deps, cur, "extracting");
    cur = await transition(deps, cur, "normalizing");
    await enqueue(deps, cur.id); // understanding runs in the background
    results.push(cur);
  }
  return results;
}

function firstLine(s: string): string {
  const line = s.split("\n").find((l) => l.trim()) ?? s;
  return line.trim().replace(/^#+\s*/, "").slice(0, 80);
}

export const INCOMING_PREFIX = "incoming";

/** Where a browser may upload directly (signed upload URL). Only the owner's own incoming folder. */
export function incomingPath(creatorId: string): string {
  return `${creatorId}/${INCOMING_PREFIX}/${randomUUID()}`;
}

export function isOwnIncomingPath(creatorId: string, path: string): boolean {
  return new RegExp(`^${creatorId}/${INCOMING_PREFIX}/[0-9a-f-]{36}$`).test(path);
}

/**
 * A file the browser uploaded directly to storage. It is downloaded and validated exactly like a
 * posted file; rejected bytes are deleted, never registered.
 */
export async function receiveUploadedObject(
  deps: IntakeDeps,
  input: { batchId: string; path: string; filename?: string | null; kind?: "camera" | "voice" | null; instruction?: string | null },
) {
  if (!isOwnIncomingPath(deps.creatorId, input.path)) throw new DomainError("forbidden", "That upload doesn't belong to you.");
  const dl = await deps.service.storage.from(MATERIAL_BUCKET).download(input.path);
  if (dl.error || !dl.data) throw new DomainError("validation", "We couldn't find that upload. Please try again.");
  const bytes = new Uint8Array(await dl.data.arrayBuffer());
  try {
    return await receiveFile(deps, { ...input, bytes, existingPath: input.path });
  } catch (e) {
    await deps.service.storage.from(MATERIAL_BUCKET).remove([input.path]).catch(() => undefined);
    throw e;
  }
}

export async function receiveFile(
  deps: IntakeDeps,
  input: { batchId: string; bytes: Uint8Array; filename?: string | null; kind?: "camera" | "voice" | null; instruction?: string | null; existingPath?: string },
) {
  const name = safeFilename(input.filename);
  const item0 = await newIntake(deps, { batchId: input.batchId, kind: input.kind === "camera" ? "camera" : input.kind === "voice" ? "voice" : "document", instruction: input.instruction });
  let item = await transition(deps, item0, "validating");

  let inspected;
  try {
    inspected = await inspectUpload(input.bytes, name ?? undefined);
  } catch (e) {
    const code = isDomainError(e) ? e.code : "internal";
    const message = isDomainError(e) ? e.message : "We couldn't check that file.";
    // Unsafe or unsupported bytes are not stored; the attempt is recorded.
    await transition(deps, item, code === "unsupported_media" || code === "security_rejected" ? "quarantined" : "failed", { error_code: code, error_message: message });
    await publishEvent(deps.db, { type: "CreativeMaterialSecurityRejected", aggregate: "material", aggregateId: null, payload: { reason: code, intakeId: item.id } });
    throw e;
  }
  const kindForInput: InputKind =
    input.kind === "camera" ? "camera" : input.kind === "voice" ? "voice" : inspected.kind === "text" ? "document" : inspected.kind === "pdf" ? "pdf" : inspected.kind;
  item = must(await deps.service.from("intake_items").update({ input_kind: kindForInput }).eq("id", item.id).select("*").single());
  item = await transition(deps, item, "security_review");

  // Store the original privately. Path is opaque and never shown to clients.
  const path = input.existingPath ?? `${deps.creatorId}/${randomUUID()}`;
  const up = input.existingPath ? { error: null } : await deps.service.storage.from(MATERIAL_BUCKET).upload(path, input.bytes, { contentType: inspected.mime, upsert: false });
  if (up.error) {
    await transition(deps, item, "failed", { error_code: "storage", error_message: "We couldn't store the file. Please try again." });
    throw new DomainError("provider_failed", "We couldn't store the file. Please try again.", { cause: up.error });
  }
  const obj = must(
    await deps.service
      .from("storage_objects")
      .insert({
        creator_id: deps.creatorId,
        bucket: MATERIAL_BUCKET,
        path,
        mime_type: inspected.mime,
        size_bytes: inspected.size,
        sha256: inspected.sha256,
        original_filename: name,
        // Content-type allow-list + size limits passed. No malware scanner is configured; see docs/security.md.
        security_status: "clean",
      })
      .select("id")
      .single(),
  );

  const type: MaterialType = input.kind === "voice" ? "voice" : KIND_TO_TYPE[inspected.kind];
  const material = await createMaterial(deps.db, deps.creatorId, {
    type,
    title: name ? name.replace(/\.[a-z0-9]{1,5}$/i, "") : input.kind === "camera" ? "Photo" : input.kind === "voice" ? "Voice note" : "Untitled",
    storageObjectId: obj.id,
    sourceType: input.kind ?? "upload",
    metadata: { mime: inspected.mime, size: inspected.size },
    provenance: { origin: input.kind === "camera" ? "camera" : input.kind === "voice" ? "voice_recording" : "upload", originalFilename: name, sha256: inspected.sha256 },
  });
  await deps.service.from("creative_materials").update({ security_status: "clean" }).eq("id", material.id).eq("creator_id", deps.creatorId);
  item = must(await deps.service.from("intake_items").update({ material_id: material.id, storage_object_id: obj.id }).eq("id", item.id).select("*").single());
  item = await transition(deps, item, "extracting");
  await enqueue(deps, item.id);
  return item;
}

export async function receiveUrl(deps: IntakeDeps, input: { batchId: string; url: string; instruction?: string | null }) {
  const url = parseExternalUrl(input.url); // syntactic SSRF guard before anything is stored
  const yt = parseYouTubeId(url.toString());
  const item0 = await newIntake(deps, { batchId: input.batchId, kind: yt ? "youtube" : "url", sourceUrl: url.toString(), instruction: input.instruction });
  const material = await createMaterial(deps.db, deps.creatorId, {
    type: "url",
    title: yt ? "YouTube video" : url.hostname.replace(/^www\./, ""),
    sourceUrl: url.toString(),
    sourceType: yt ? "youtube" : "web",
    metadata: yt ? { youtubeId: yt } : {},
    provenance: { origin: yt ? "youtube" : "url", sourceUrl: url.toString() },
  });
  const item = must(await deps.service.from("intake_items").update({ material_id: material.id }).eq("id", item0.id).select("*").single());
  await enqueue(deps, item.id);
  return item;
}

// ---------------------------------------------------------------------------
// Process (background, durable): extract, normalize, understand.
// ---------------------------------------------------------------------------
async function loadBytes(service: Db, storageObjectId: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const obj = await service.from("storage_objects").select("bucket, path, mime_type").eq("id", storageObjectId).maybeSingle();
  if (!obj.data) return null;
  const dl = await service.storage.from(obj.data.bucket).download(obj.data.path);
  if (dl.error || !dl.data) return null;
  return { bytes: new Uint8Array(await dl.data.arrayBuffer()), mime: obj.data.mime_type };
}

type Extracted = { text: string | null; note?: string; pages?: number; transcription?: { provider: string; model: string } };

async function extractText(bytes: Uint8Array, mime: string, provider?: CreativeModelProvider): Promise<Extracted> {
  if (mime.startsWith("text/")) return { text: new TextDecoder().decode(bytes).slice(0, 200000) };
  if (mime === "application/pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text, totalPages } = await pdfText(pdf, { mergePages: true });
    return { text: (text as string).slice(0, 200000), pages: totalPages };
  }
  if (mime.startsWith("audio/") || mime.startsWith("video/")) return transcribe(bytes, mime, provider);
  if (mime.includes("wordprocessingml")) {
    const text = extractDocxText(bytes);
    if (text === null) return { text: null, note: "We couldn't read the text in this Word document. The original is saved." };
    return text ? { text } : { text: null, note: "This Word document has no text to read. The original is saved." };
  }
  return { text: null };
}

/** Transcription is best-effort: a failure leaves the original saved and playable, never a failed intake. */
async function transcribe(bytes: Uint8Array, mime: string, provider?: CreativeModelProvider): Promise<Extracted> {
  const kind = mime.startsWith("video/") ? "video" : "audio";
  if (!provider?.transcribe) {
    return { text: null, note: "Transcription isn't available with the current AI setup. The original is saved and playable." };
  }
  try {
    const out = await provider.transcribe({ kind, mimeType: mime, bytes });
    const text = out.text.trim();
    if (!text || /^\[no speech\]$/i.test(text)) return { text: null, note: `No speech was found in this ${kind}. The original is saved and playable.` };
    return { text: text.slice(0, 200000), transcription: { provider: out.provider, model: out.model } };
  } catch (e) {
    log("warn", "intake.transcribe_failed", { code: isDomainError(e) ? e.code : "internal" });
    return { text: null, note: `We couldn't transcribe this ${kind} right now. The original is saved and playable.` };
  }
}

export async function processIntake(deps: IntakeDeps, intakeId: string): Promise<IntakeItem> {
  let item = must(await deps.service.from("intake_items").select("*").eq("id", intakeId).eq("creator_id", deps.creatorId).maybeSingle(), "Intake not found.");
  if (item.state === "ready" || item.state === "quarantined") return item;
  if (!item.material_id) throw new DomainError("internal", "Intake has no material.");
  const material = must(await deps.service.from("creative_materials").select("*").eq("id", item.material_id).eq("creator_id", deps.creatorId).maybeSingle());

  try {
    if (item.state === "received" || item.state === "failed") item = await transition(deps, item, item.state === "failed" ? "extracting" : "validating");
    if (item.state === "validating") item = await transition(deps, item, "security_review");
    if (item.state === "security_review") item = await transition(deps, item, "extracting");

    let extracted: string | null = material.extracted_text;
    const meta: Record<string, unknown> = { ...(material.metadata as Record<string, unknown>) };
    let title = material.title;
    let image: { mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; dataBase64: string } | null = null;

    if (item.state === "extracting") {
      if (material.storage_object_id) {
        const file = await loadBytes(deps.service, material.storage_object_id);
        if (!file) throw new DomainError("provider_failed", "We couldn't read the stored file.");
        const ex = await extractText(file.bytes, file.mime, deps.provider);
        extracted = ex.text;
        if (ex.pages) meta.pages = ex.pages;
        if (ex.transcription) meta.transcription = ex.transcription;
        if (ex.note) meta.processingNote = ex.note;
        else delete meta.processingNote;
        if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.mime) && file.bytes.byteLength <= 5 * 1024 * 1024) {
          image = { mediaType: file.mime as "image/png", dataBase64: Buffer.from(file.bytes).toString("base64") };
        }
      } else if (material.source_url) {
        const yt = parseYouTubeId(material.source_url);
        if (yt) {
          const res = await safeFetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${yt}`)}`, { maxBytes: 100_000, accept: "application/json" });
          if (res.status === 200) {
            const o = JSON.parse(new TextDecoder().decode(res.body)) as { title?: string; author_name?: string; thumbnail_url?: string };
            title = o.title?.slice(0, 200) ?? title;
            Object.assign(meta, { author: o.author_name ?? null, thumbnailUrl: o.thumbnail_url ?? null, youtubeId: yt });
            extracted = [o.title, o.author_name ? `by ${o.author_name}` : null].filter(Boolean).join(" ");
          } else {
            meta.processingNote = "YouTube didn't share details for this video; the link is saved.";
          }
        } else {
          const res = await safeFetch(material.source_url, { maxBytes: 2_000_000 });
          if (res.status >= 400) throw new DomainError("provider_failed", `That page answered with an error (${res.status}). The link is saved; try again later.`);
          if (res.contentType.includes("application/pdf")) {
            const ex = await extractText(res.body, "application/pdf");
            extracted = ex.text;
          } else if (res.contentType.includes("html") || res.contentType.startsWith("text/")) {
            const page = extractPage(new TextDecoder().decode(res.body), res.finalUrl);
            title = page.title?.slice(0, 200) ?? title;
            extracted = [page.description, page.text].filter(Boolean).join("\n\n").slice(0, 50000);
            Object.assign(meta, { description: page.description, siteName: page.siteName, previewImageUrl: page.image, finalUrl: res.finalUrl });
          } else {
            meta.processingNote = "This link isn't a web page we can read; it's saved as a reference.";
          }
        }
      }
      await deps.service
        .from("creative_materials")
        .update({ extracted_text: extracted, metadata: meta as JsonValue, title })
        .eq("id", material.id)
        .eq("creator_id", deps.creatorId);
      item = await transition(deps, item, "normalizing");
    }

    if (item.state === "normalizing") {
      const text = [material.text_content, extracted].filter(Boolean).join("\n\n");
      const understood = await understandMaterial(deps.provider, { title, type: material.type, text: text || null, image }).catch((e) => {
        log("warn", "intake.understand_failed", { intakeId, code: isDomainError(e) ? e.code : "internal" });
        return null;
      });
      if (understood) {
        await deps.db.from("creative_materials").update({ understanding: understood.value as unknown as JsonValue }).eq("id", material.id);
        if (understood.value.themes.length) {
          await deps.db
            .from("creative_material_tags")
            .upsert(understood.value.themes.slice(0, 5).map((tag) => ({ material_id: material.id, creator_id: deps.creatorId, tag: tag.slice(0, 40) })), { ignoreDuplicates: true });
        }
        item = await transition(deps, item, "understood");
      }
      item = await transition(deps, item, "ready");
    }
    if (item.state === "understood") item = await transition(deps, item, "ready");
    // Semantic search index: best effort, never fails the intake.
    await indexStaleSubjects(deps.service, deps.provider, { creatorId: deps.creatorId, limit: 5 }).catch((e) =>
      log("warn", "intake.index_failed", { intakeId, code: isDomainError(e) ? e.code : "internal" }),
    );
    await publishEvent(deps.db, { type: "CreativeMaterialUpdated", aggregate: "material", aggregateId: material.id, payload: { state: item.state } }).catch(() => undefined);
    return item;
  } catch (e) {
    const message = isDomainError(e) && e.status < 500 ? e.message : isDomainError(e) ? e.message : "Something went wrong while processing.";
    const latest = must(await deps.service.from("intake_items").select("*").eq("id", intakeId).single());
    if (latest.state !== "failed" && canTransition(latest.state, "failed")) {
      await transition(deps, latest, "failed", { error_code: isDomainError(e) ? e.code : "internal", error_message: `${message} Your original is safe.`, attempts: latest.attempts + 1 });
    }
    throw e;
  }
}

export async function listIntake(db: Db, opts: { limit?: number; batchId?: string } = {}) {
  let q = db
    .from("intake_items")
    .select("*, creative_materials(id, title, type, storage_object_id, source_url, metadata)")
    .order("created_at", { ascending: false })
    .limit(Math.min(opts.limit ?? 30, 100));
  if (opts.batchId) q = q.eq("batch_id", opts.batchId);
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  return data ?? [];
}

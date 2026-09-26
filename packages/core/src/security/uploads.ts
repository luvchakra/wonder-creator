import { createHash } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { DomainError } from "../errors";

export type MediaKind = "image" | "audio" | "video" | "pdf" | "document" | "text";

/** Allow-list of content-detected MIME types. Extensions and declared types are never trusted. */
const ALLOWED: Record<string, MediaKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/heic": "image",
  "image/avif": "image",
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/x-m4a": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/ogg": "audio",
  "audio/webm": "audio",
  "audio/aac": "audio",
  "audio/flac": "audio",
  "audio/x-flac": "audio",
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "text/plain": "text",
  "text/markdown": "text",
};

export const SIZE_LIMITS: Record<MediaKind, number> = {
  image: 20 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  pdf: 25 * 1024 * 1024,
  document: 25 * 1024 * 1024,
  text: 2 * 1024 * 1024,
};

export const MAX_UPLOAD_BYTES = Math.max(...Object.values(SIZE_LIMITS));

export interface InspectedFile {
  mime: string;
  kind: MediaKind;
  sha256: string;
  size: number;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function looksLikeUtf8Text(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 8192);
  if (sample.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample);
    return true;
  } catch {
    return false;
  }
}

/** Security validation for every uploaded file. Throws a creator-readable DomainError on rejection. */
export async function inspectUpload(bytes: Uint8Array, declaredName?: string): Promise<InspectedFile> {
  if (bytes.byteLength === 0) throw new DomainError("validation", "That file is empty.");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new DomainError("payload_too_large", "That file is larger than we can accept right now.");
  }
  const detected = await fileTypeFromBuffer(bytes);
  let mime = detected?.mime as string | undefined;
  if (!mime) {
    // Plain text has no magic number: accept only valid UTF-8 without NUL bytes.
    if (looksLikeUtf8Text(bytes)) {
      mime = declaredName?.toLowerCase().endsWith(".md") ? "text/markdown" : "text/plain";
    }
  }
  if (mime === "audio/x-m4a") mime = "audio/mp4";
  const kind = mime ? ALLOWED[mime] : undefined;
  if (!mime || !kind) {
    throw new DomainError("unsupported_media", "We can't accept this kind of file yet. Try an image, audio, video, PDF or text file.");
  }
  if (bytes.byteLength > SIZE_LIMITS[kind]) {
    throw new DomainError("payload_too_large", `That ${kind} file is too large (limit ${Math.round(SIZE_LIMITS[kind] / 1024 / 1024)} MB).`);
  }
  return { mime, kind, sha256: sha256Hex(bytes), size: bytes.byteLength };
}

/** Strip path components and control characters from a user-supplied filename. */
export function safeFilename(name: string | undefined | null): string | null {
  if (!name) return null;
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180);
  return clean || null;
}

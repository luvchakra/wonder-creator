import "server-only";
import { DomainError } from "@wonder/core";
import { mediaLink } from "@wonder/core/server";
import { signedUrlsFor } from "@wonder/creator-library";
import type { Db } from "@wonder/db";

/**
 * Looking back on what you caught (owner, 7 Oct 2026: "give me an option to look back on quick notes, voice notes etc
 * from home page itself"). A capture is a Material the creator made themselves in the moment: a typed note or idea, a
 * voice note, a picture or a video from the camera — not uploads, links or imports. Read through the creator's own
 * RLS-scoped client; media addresses are minted only for what that read returned.
 */
export const CAPTURE_KINDS = ["note", "voice", "photo", "video"] as const;
export type CaptureKind = (typeof CAPTURE_KINDS)[number];
export const CAPTURE_KIND_LABEL: Record<CaptureKind, string> = { note: "Notes", voice: "Voice", photo: "Pictures", video: "Videos" };

export interface Capture {
  id: string;
  kind: CaptureKind;
  /** The note's words, or what was said (once transcribed). */
  text: string | null;
  title: string;
  seconds: number | null;
  /** A picture to show (pictures), or the recording to play (voice and video). */
  mediaUrl: string | null;
  createdAt: string;
}

const FILTER: Record<CaptureKind, string> = {
  note: "and(source_type.eq.typed,type.in.(idea,note))",
  voice: "source_type.in.(voice,voice_transcript)",
  photo: "and(source_type.eq.camera,type.eq.image)",
  video: "and(source_type.eq.camera,type.eq.video)",
};

const kindOf = (r: { type: string; source_type: string | null }): CaptureKind =>
  r.source_type === "voice" || r.source_type === "voice_transcript" ? "voice" : r.source_type === "camera" ? (r.type === "video" ? "video" : "photo") : "note";

export async function recentCaptures(db: Db, creatorId: string, opts: { kind?: CaptureKind | null; before?: string | null; limit?: number } = {}): Promise<{ items: Capture[]; next: string | null }> {
  const limit = Math.min(60, Math.max(1, opts.limit ?? 24));
  let q = db
    .from("creative_materials")
    .select("id, type, source_type, title, text_content, extracted_text, storage_object_id, metadata, created_at")
    .eq("creator_id", creatorId)
    .eq("status", "active")
    .or(opts.kind ? FILTER[opts.kind] : Object.values(FILTER).join(","))
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (opts.before) {
    if (Number.isNaN(Date.parse(opts.before))) throw new DomainError("validation", "That isn't a time.");
    q = q.lt("created_at", opts.before);
  }
  const { data, error } = await q;
  if (error) throw new DomainError("internal", "We couldn't read your captures.", { cause: error });
  const rows = (data ?? []).slice(0, limit);
  // Stable links where the server can sign them (cached by the browser); short-lived ones otherwise.
  const objects = rows.filter((r) => r.storage_object_id && kindOf(r) !== "note").map((r) => r.storage_object_id!);
  const stable = new Map(objects.map((id) => [id, mediaLink(id)]));
  const signed = [...stable.values()].every(Boolean) ? {} : await signedUrlsFor(db, objects).catch(() => ({}) as Record<string, string>);
  const items = rows.map((r) => {
    const kind = kindOf(r);
    const meta = (r.metadata ?? {}) as { durationSeconds?: unknown };
    const text = (kind === "note" ? r.text_content : r.extracted_text)?.trim() || null;
    return {
      id: r.id,
      kind,
      text: text ? text.slice(0, 600) : null,
      // A voice note's stored name carries the server's clock ("Voice note 7 Oct, 02:30"); the time is shown in the viewer's own.
      title: (kind === "voice" && /^Voice note \d/.test(r.title ?? "") ? null : r.title) ?? (kind === "voice" ? "Voice note" : kind === "photo" ? "Picture" : kind === "video" ? "Video" : "Note"),
      seconds: typeof meta.durationSeconds === "number" ? meta.durationSeconds : null,
      mediaUrl: r.storage_object_id && kind !== "note" ? (stable.get(r.storage_object_id) ?? signed[r.storage_object_id] ?? null) : null,
      createdAt: r.created_at,
    };
  });
  return { items, next: data && data.length > limit ? rows[rows.length - 1]!.created_at : null };
}

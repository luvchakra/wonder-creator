import "server-only";
import { signedUrlsFor } from "@wonder/creator-library";
import type { listIntake } from "@wonder/creator-send";
import type { Db } from "@wonder/db";

/** One "Recent sends" row: the item's progress plus a small preview of what it actually is. */
export interface IntakeView {
  id: string;
  state: string;
  kind: string;
  error: string | null;
  createdAt: string;
  material: { id: string; title: string | null; type: string } | null;
  preview: { imageUrl: string | null; snippet: string | null; domain: string | null };
}

type IntakeRow = Awaited<ReturnType<typeof listIntake>>[number];
type MaterialJoin = { id: string; title: string | null; type: string; storage_object_id: string | null; source_url: string | null; text_content: string | null; extracted_text: string | null } | null;

const IMAGE_TYPES = new Set(["image", "sketch"]);
const clip = (t: string | null | undefined, n = 90) => {
  const s = (t ?? "").replace(/\s+/g, " ").trim();
  return s ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : null;
};
const domainOf = (u: string | null) => {
  try {
    return u ? new URL(u).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
};

/** Rows for the list, with signed (RLS-scoped, short-lived) image previews and short text snippets — never full text. */
export async function intakeViews(db: Db, rows: IntakeRow[]): Promise<IntakeView[]> {
  const mats = rows.map((r) => r.creative_materials as unknown as MaterialJoin);
  const images = await signedUrlsFor(
    db,
    mats.map((m) => (m && IMAGE_TYPES.has(m.type) ? m.storage_object_id : null)),
  );
  return rows.map((r, i) => {
    const m = mats[i];
    // A note's title is its first line: show what comes after it rather than the same words twice.
    const full = (m ? (["voice", "audio", "document", "pdf", "video"].includes(m.type) ? m.extracted_text : (m.text_content ?? m.extracted_text)) : null)?.replace(/\s+/g, " ").trim() ?? "";
    const title = (m?.title ?? "").replace(/\s+/g, " ").trim();
    const snippet = clip(title && full.startsWith(title) ? full.slice(title.length) : full);
    return {
      id: r.id,
      state: r.state,
      kind: r.input_kind,
      error: r.error_message,
      createdAt: r.created_at,
      material: m ? { id: m.id, title: m.title, type: m.type } : null,
      preview: {
        imageUrl: m?.storage_object_id ? (images[m.storage_object_id] ?? null) : null,
        snippet,
        domain: domainOf(m?.source_url ?? null),
      },
    };
  });
}

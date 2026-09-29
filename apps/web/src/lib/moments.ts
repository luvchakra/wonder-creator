import "server-only";
import type { Db } from "@wonder/db";
import { signedUrlsFor } from "@wonder/creator-library";
import type { MomentPage, MomentReference } from "@wonder/creator-moments";

export type MomentView = MomentReference & { thumbUrl: string | null };

/** Pictures for Moment rows, through the viewer's own access (stable, cacheable links; see mediaLink). */
export async function withThumbs(db: Db, page: MomentPage): Promise<{ items: MomentView[]; nextCursor: string | null }> {
  const pictures = page.items.filter((m) => m.previewAssetId && (m.previewKind === "image" || m.previewKind === "mixed"));
  const urls = await signedUrlsFor(
    db,
    pictures.map((m) => m.previewAssetId),
  ).catch(() => ({}) as Record<string, string>);
  return { items: page.items.map((m) => ({ ...m, thumbUrl: (m.previewAssetId && urls[m.previewAssetId]) || null })), nextCursor: page.nextCursor };
}

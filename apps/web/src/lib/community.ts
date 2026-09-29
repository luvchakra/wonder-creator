import "server-only";
import type { CommunityCard } from "@wonder/creator-community";
import type { Db } from "@wonder/db";
import { coverUrls } from "./covers";

export type CommunityCardView = CommunityCard & { coverUrl?: string | null };

/** Covers for Creation cards, through the viewer's own access. */
export async function communityView(db: Db, feed: { cards: CommunityCard[]; nextBefore: string | null }): Promise<{ cards: CommunityCardView[]; nextBefore: string | null }> {
  const creations = feed.cards.filter((c): c is Extract<CommunityCard, { kind: "creation" }> => c.kind === "creation");
  const covers = creations.length ? await coverUrls(db, creations.map((c) => ({ id: c.id, cover_material_id: c.coverMaterialId }))).catch(() => ({}) as Record<string, string>) : {};
  return { cards: feed.cards.map((c) => (c.kind === "creation" ? { ...c, coverUrl: covers[c.id] ?? null } : c)), nextBefore: feed.nextBefore };
}

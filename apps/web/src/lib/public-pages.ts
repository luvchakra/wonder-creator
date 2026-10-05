import "server-only";
import { mediaLink } from "@wonder/core/server";
import { normalizeSections, resolveTemplateId, type CreatorPageTemplateId } from "@wonder/creator-studio/creator-page";
import { previewPublication } from "@wonder/creator-studio";
import type { PublicRights, PublicationManifest, PublicationVisibility, PublishSettings, PublishedSnapshot } from "@wonder/creator-studio/publish";
import { headers } from "next/headers";
import { createClient } from "./supabase/server";

/**
 * Loading CreatorPublish's public pages (docs/creator-publish.md §35). Signed-out readers go only through the database's
 * publication-safe functions (`public_work`, `public_creator_page`, `public_dejavu`) — never through app state. Storage
 * objects named in a published snapshot become stable media links here, minted per view.
 */

export interface PublicCard {
  slug: string;
  featured: boolean;
  title: string;
  creationType: string;
  typeLabel: string;
  experience: PublicationManifest["experience"];
  descriptor: string;
  coverUrl: string | null;
  durationSeconds: number | null;
  itemCount: number | null;
  publishedAt: string;
  href: string;
  /** Opening words of work read as text, so it can render as typography. */
  excerpt?: string | null;
  poem?: boolean;
}

export interface PublicWorkView {
  workId: string;
  slug: string;
  visibility: PublicationVisibility;
  settings: PublishSettings;
  revision: { number: number; publishedAt: string };
  manifest: PublicationManifest;
  snapshot: PublishedSnapshot;
  rights: PublicRights;
  provenance: { versionNumber: number | null; revisionNumber: number; madeFrom: Record<string, number> };
  creator: { handle: string; name: string; avatarUrl: string | null; pagePublished: boolean };
  more: PublicCard[];
  conversation: { id: string; title: string; replyCount: number } | null;
  /** Media links for every storage object in the snapshot. */
  media: Record<string, string>;
  /** Only the creator is looking (a private work, or a preview). */
  preview: boolean;
  /** A preview of a published, unchanged work: what readers see now, so no notice. */
  livePreview?: boolean;
}

type RawCard = Omit<PublicCard, "coverUrl" | "href"> & { coverObjectId: string | null };
const link = (id: string | null | undefined) => (id ? mediaLink(id) : null);
const card = (handle: string, c: RawCard): PublicCard => ({ ...c, coverUrl: link(c.coverObjectId), href: `/p/${handle}/${c.slug}` });

/** Every storage object a snapshot names. */
export function snapshotObjects(s: PublishedSnapshot): string[] {
  const ids = [s.coverObjectId, s.media?.objectId, s.media?.posterObjectId, s.voice?.objectId, ...(s.slides ?? []).map((x) => x.objectId), ...(s.images ?? []).map((x) => x.objectId), ...(s.deck?.slides ?? []).map((x) => x.objectId)];
  for (const b of s.blocks ?? []) if (b.kind !== "text") ids.push(b.objectId, b.kind === "video" ? b.posterObjectId : null);
  return [...new Set(ids.filter((x): x is string => !!x))];
}

type RawWork = Omit<PublicWorkView, "more" | "media" | "preview" | "creator"> & { creator: { handle: string; name: string; avatarObjectId: string | null; pagePublished: boolean }; more: RawCard[] };

function toView(raw: RawWork, preview: boolean): PublicWorkView {
  const media: Record<string, string> = {};
  for (const id of snapshotObjects(raw.snapshot)) {
    const l = mediaLink(id);
    if (l) media[id] = l;
  }
  return {
    ...raw,
    creator: { handle: raw.creator.handle, name: raw.creator.name, avatarUrl: link(raw.creator.avatarObjectId), pagePublished: raw.creator.pagePublished },
    more: (raw.more ?? []).filter(Boolean).map((c) => card(raw.creator.handle, c)),
    media,
    preview,
  };
}

/**
 * The creator's own Creation as its public page would show it right now — before (or after) publishing. Built as the
 * creator under RLS; nothing is written. Media links are minted like the public page's.
 */
export async function loadWorkPreview(db: Parameters<typeof previewPublication>[0], creator: { id: string; handle: string | null; name: string; avatarObjectId: string | null }, artifactId: string) {
  const p = await previewPublication(db, creator.id, artifactId);
  const { data: page } = await db.from("creator_pages").select("is_published").eq("creator_id", creator.id).maybeSingle();
  const view = toView(
    {
      workId: artifactId,
      slug: p.slug,
      visibility: p.visibility,
      settings: p.settings,
      revision: { number: p.provenance.revisionNumber, publishedAt: new Date().toISOString() },
      manifest: p.manifest,
      snapshot: p.snapshot,
      rights: p.rights,
      provenance: p.provenance,
      creator: { handle: creator.handle ?? "", name: creator.name, avatarObjectId: creator.avatarObjectId, pagePublished: !!page?.is_published },
      more: [],
      conversation: null,
    },
    true,
  );
  // Published and unchanged: readers see exactly this, so no "only you can see this" notice (views still aren't counted).
  if (p.published && !p.changedSincePublished) view.livePreview = true;
  return { view, published: p.published, changedSincePublished: p.changedSincePublished, empty: p.empty };
}

/**
 * A published work for any reader. A private work (or one taken down) is visible only to its creator, as a preview —
 * read through their own access, never the public function.
 */
export async function loadPublicWork(handle: string, slug: string): Promise<PublicWorkView | null> {
  const db = await createClient();
  const { data } = await db.rpc("public_work", { p_handle: handle, p_slug: slug });
  if (data) return toView(data as unknown as RawWork, false);
  // The creator's own preview.
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims?.sub) return null;
  const { data: me } = await db.from("creators").select("id, handle, display_name, avatar_object_id").eq("user_id", claims.claims.sub as string).maybeSingle();
  if (!me || me.handle !== handle.toLowerCase()) return null;
  const { data: w } = await db.from("published_works").select("id, slug, visibility, settings, current_revision_id").eq("creator_id", me.id).eq("slug", slug.toLowerCase()).maybeSingle();
  if (!w?.current_revision_id) return null;
  const { data: r } = await db.from("published_revisions").select("revision_number, published_at, manifest, snapshot, rights_snapshot, provenance_snapshot").eq("id", w.current_revision_id).maybeSingle();
  if (!r) return null;
  const { data: page } = await db.from("creator_pages").select("is_published").eq("creator_id", me.id).maybeSingle();
  return toView(
    {
      workId: w.id,
      slug: w.slug,
      visibility: w.visibility as PublicationVisibility,
      settings: w.settings as PublishSettings,
      revision: { number: r.revision_number, publishedAt: r.published_at },
      manifest: r.manifest as unknown as PublicationManifest,
      snapshot: r.snapshot as unknown as PublishedSnapshot,
      rights: r.rights_snapshot as unknown as PublicRights,
      provenance: r.provenance_snapshot as unknown as RawWork["provenance"],
      creator: { handle: me.handle ?? handle, name: me.display_name, avatarObjectId: me.avatar_object_id, pagePublished: !!page?.is_published },
      more: [],
      conversation: null,
    },
    true,
  );
}

export interface PublicCreatorPage {
  creator: { id: string; handle: string; name: string; bio: string | null; location: string | null; avatarUrl: string | null; roles: string[] };
  isPublished: boolean;
  templateId: CreatorPageTemplateId;
  /** Every template's settings (presentation only). */
  templateSettings: unknown;
  headline: string | null;
  intro: string | null;
  sections: Array<{ section: string; enabled: boolean }>;
  links: Array<{ label: string; url: string }>;
  works: PublicCard[];
  dejavus: Array<{ id: string; name: string; description: string | null; count: number; coverUrl: string | null }>;
  moments: Array<{ id: string; body: string; kind: string; createdAt: string; imageUrl: string | null }>;
  conversations: Array<{ id: string; title: string; replyCount: number; createdAt: string }>;
  openTo: string[];
  /** Testimonials the creator chose to show here too (docs/testimonials.md); absent on older fixtures. */
  testimonials?: Array<{ id: string; fromName: string; fromHandle: string | null; body: string; createdAt: string }>;
}

type RawCreatorPage = Omit<PublicCreatorPage, "works" | "moments" | "creator" | "dejavus" | "templateId" | "testimonials"> & {
  creator: Omit<PublicCreatorPage["creator"], "avatarUrl"> & { avatarObjectId: string | null };
  templateId: string;
  works: RawCard[];
  dejavus: Array<Omit<PublicCreatorPage["dejavus"][number], "coverUrl"> & { coverObjectId: string | null }>;
  moments: Array<{ id: string; body: string; kind: string; createdAt: string; imageObjectId: string | null }>;
};

function toCreatorPage(raw: RawCreatorPage, testimonials: NonNullable<PublicCreatorPage["testimonials"]> = []): PublicCreatorPage {
  return {
    ...raw,
    testimonials,
    templateId: resolveTemplateId(raw.templateId),
    sections: normalizeSections(raw.sections),
    creator: { ...raw.creator, roles: raw.creator.roles ?? [], avatarUrl: link(raw.creator.avatarObjectId) },
    works: (raw.works ?? []).filter(Boolean).map((c) => card(raw.creator.handle, c)),
    dejavus: (raw.dejavus ?? []).map(({ coverObjectId, ...d }) => ({ ...d, coverUrl: link(coverObjectId) })),
    moments: (raw.moments ?? []).map((m) => ({ ...m, imageUrl: link(m.imageObjectId) })),
  };
}

export async function loadCreatorPage(handle: string): Promise<PublicCreatorPage | null> {
  const db = await createClient();
  const [{ data }, { data: quotes }] = await Promise.all([db.rpc("public_creator_page", { p_handle: handle }), db.rpc("public_creator_page_testimonials", { p_handle: handle })]);
  return data ? toCreatorPage(data as unknown as RawCreatorPage, (quotes ?? []).map((q) => ({ id: q.id, fromName: q.from_name, fromHandle: q.from_handle, body: q.body, createdAt: q.created_at }))) : null;
}

/** The signed-in creator's own page exactly as the public would see it — published or not (the owner's preview). */
export async function loadCreatorPagePreview(): Promise<PublicCreatorPage | null> {
  const db = await createClient();
  const { data } = await db.rpc("creator_page_preview");
  if (!data) return null;
  const raw = data as unknown as RawCreatorPage;
  // The owner's preview shows the testimonials they chose for the page, published or not.
  const { data: quotes } = await db.rpc("testimonials_of", { p_creator: raw.creator.id });
  return toCreatorPage(
    raw,
    (quotes ?? []).filter((q) => q.status === "shown" && q.on_creator_page).map((q) => ({ id: q.id, fromName: q.from_name, fromHandle: q.from_handle, body: q.body, createdAt: q.created_at })),
  );
}

export interface PublicDejaVuPage {
  creator: { handle: string; name: string };
  dejavu: { id: string; name: string; description: string | null };
  items: Array<{ kind: "creation"; at: string; card: PublicCard } | { kind: "moment"; at: string; moment: { id: string; body: string; kind: string; imageUrl: string | null } }>;
}

export async function loadPublicDejaVu(handle: string, id: string): Promise<PublicDejaVuPage | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await createClient();
  const { data } = await db.rpc("public_dejavu", { p_handle: handle, p_dejavu: id });
  if (!data) return null;
  const raw = data as unknown as { creator: PublicDejaVuPage["creator"]; dejavu: PublicDejaVuPage["dejavu"]; items: Array<{ kind: string; at: string; card?: RawCard; moment?: { id: string; body: string; kind: string; imageObjectId: string | null } }> };
  return {
    ...raw,
    items: (raw.items ?? []).map((i) =>
      i.kind === "creation" ? { kind: "creation" as const, at: i.at, card: card(raw.creator.handle, i.card!) } : { kind: "moment" as const, at: i.at, moment: { ...i.moment!, imageUrl: link(i.moment!.imageObjectId) } },
    ),
  };
}

/** The signed-in viewer's creator id, if any (to show owners their subtle "Edit Creator Page" overlay). */
export async function viewerCreatorId(): Promise<string | null> {
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims?.sub) return null;
  const { data } = await db.from("creators").select("id").eq("user_id", claims.claims.sub as string).maybeSingle();
  return data?.id ?? null;
}

/** The site's own origin, for canonical URLs and share previews. */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

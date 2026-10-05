import { carouselView, findingsOf, providerReadiness } from "@wonder/creator-brain";
import { actionsFor, artifactType, audioSetOf, creationPath, deckOf, imageSetOf, storyboardOf, lookOf, ornamentOf, writingStyleOf } from "@wonder/creator-studio";
import { signedUrlsFor } from "@wonder/creator-library";
import { partContextFor, partTakes, partWords, type PlayAlong } from "@wonder/creator-projects";
import { mediaLink } from "@wonder/core/server";
import { notFound, redirect } from "next/navigation";
import { PaletteScope } from "@/components/creative-palette";
import { avatarUrls } from "@/lib/avatars";
import { coverUrls } from "@/lib/covers";
import { siteOrigin } from "@/lib/public-pages";
import { requireSession } from "@/lib/session";
import { serviceClient } from "@/lib/supabase/service";
import { ForwardTo } from "./forward";
import { Studio } from "./studio";

export type StudioSearch = { action?: string; add?: string; from?: string };

/**
 * A Creation's working page (creation-pages.md): the Creative Studio (creative-studio-working-set.md), or the page built
 * for its format (Writing at /write). Each route renders this; a Creation opened at the wrong one is sent to its own,
 * keeping what was asked for (?action, ?add, ?from). The canvas is the Creation; the Working Set lives in its
 * StudioSession, loaded by the client so the page never waits on it.
 */
export async function StudioScreen({ id, search, at }: { id: string; search: StudioSearch; at: "studio" | "write" | "image" | "audio" | "deck" | "video" }) {
  const { action, add, from } = search;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const { data: a } = await db.from("artifacts").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();
  if (a.creator_id !== creator.id) redirect(`/creations/${id}`);
  const own = creationPath(id, a.artifact_type);
  if (!own.endsWith(`/${at}`)) {
    const q = new URLSearchParams(Object.entries(search).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
    return <ForwardTo href={q ? `${own}?${q}` : own} />;
  }
  const [{ data: version }, { data: quality }, { data: pending }, { data: contributors }, covers, carousel, part] = await Promise.all([
    a.current_version_id ? db.from("artifact_versions").select("*").eq("id", a.current_version_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("quality_reports").select("*").eq("artifact_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("ai_proposals").select("id, payload, created_at").eq("status", "pending").eq("action", "apply_revision").order("created_at", { ascending: false }).limit(10),
    db.from("artifact_contributors").select("contributor_creator_id, creators!artifact_contributors_contributor_creator_id_fkey(display_name)").eq("artifact_id", id).limit(6),
    coverUrls(db, [a]),
    a.artifact_type === "carousel" ? carouselView({ db, service: serviceClient(), creatorId: creator.id }, id) : Promise.resolve(null),
    // A part of a Room's joint work (creative-room-parts.md, step 2): what it was made with, what moved on since.
    partContextFor(db, id, creator.id),
  ]);
  // The Images page (creation-pages.md, step 2): the pictures and what was done to them, from the current version.
  const imageSet = at === "image" ? imageSetOf(version?.structured_content) : null;
  let pictures: Record<string, { url: string | null; width: number | null; height: number | null; title: string | null }> = {};
  if (imageSet?.items.length) {
    const { data: mats } = await db.from("creative_materials").select("id, title, storage_object_id, metadata").in("id", imageSet.items.map((i) => i.materialId));
    const urls = await signedUrlsFor(db, (mats ?? []).map((m) => m.storage_object_id)).catch(() => ({}) as Record<string, string>);
    pictures = Object.fromEntries(
      (mats ?? []).map((m) => {
        const meta = (m.metadata ?? {}) as { width?: unknown; height?: unknown };
        return [m.id, { url: m.storage_object_id ? (urls[m.storage_object_id] ?? null) : null, width: typeof meta.width === "number" ? meta.width : null, height: typeof meta.height === "number" ? meta.height : null, title: m.title }];
      }),
    );
  }
  // The Presentation page (creation-pages.md, step 4): the deck, or the slides its outline makes.
  const deck = at === "deck" ? deckOf(version?.structured_content, version?.content ?? "") : null;
  let slidePictures: Record<string, string | null> = {};
  const slideImageIds = [...new Set((deck?.slides ?? []).map((x) => x.image).filter((x): x is string => !!x))];
  if (slideImageIds.length) {
    const { data: mats } = await db.from("creative_materials").select("id, storage_object_id").in("id", slideImageIds);
    const urls = await signedUrlsFor(db, (mats ?? []).map((m) => m.storage_object_id)).catch(() => ({}) as Record<string, string>);
    slidePictures = Object.fromEntries((mats ?? []).map((m) => [m.id, m.storage_object_id ? (urls[m.storage_object_id] ?? null) : null]));
  }
  // The Video page (creation-pages.md, step 5): the shots, and an address for each frame.
  const storyboard = at === "video" ? storyboardOf(version?.structured_content, version?.content ?? "") : null;
  let frames: Record<string, string | null> = {};
  const frameIds = [...new Set((storyboard?.shots ?? []).map((x) => x.frame).filter((x): x is string => !!x))];
  if (frameIds.length) {
    const { data: mats } = await db.from("creative_materials").select("id, storage_object_id").in("id", frameIds);
    const urls = await signedUrlsFor(db, (mats ?? []).map((m) => m.storage_object_id)).catch(() => ({}) as Record<string, string>);
    frames = Object.fromEntries((mats ?? []).map((m) => [m.id, m.storage_object_id ? (urls[m.storage_object_id] ?? null) : null]));
  }
  // The Audio page (creation-pages.md, step 3): the kept take, its address and its transcript (or why there isn't one).
  let audioTake: { materialId: string; url: string | null; seconds: number; transcript: string | null; note: string | null; done: boolean } | null = null;
  const take = at === "audio" ? audioSetOf(version?.structured_content).take : null;
  if (take) {
    const { data: m } = await db.from("creative_materials").select("id, storage_object_id, extracted_text, metadata, processing_state").eq("id", take.materialId).maybeSingle();
    if (m) {
      const urls = await signedUrlsFor(db, [m.storage_object_id]).catch(() => ({}) as Record<string, string>);
      const meta = (m.metadata ?? {}) as { processingNote?: string; durationSeconds?: number };
      audioTake = {
        materialId: m.id,
        url: m.storage_object_id ? (urls[m.storage_object_id] ?? null) : null,
        seconds: take.seconds || meta.durationSeconds || 0,
        transcript: m.extracted_text?.trim() || null,
        note: meta.processingNote ?? null,
        done: ["ready", "understood", "failed"].includes(m.processing_state ?? ""),
      };
    }
  }
  // Published and reachable (creation-pages.md): the live link shows under the title; Preview says when newer words exist.
  const { data: pub } = await db.from("published_works").select("slug, visibility, unpublished_at, current_revision_id").eq("artifact_id", id).maybeSingle();
  let published: { url: string; newer: boolean } | null = null;
  if (pub && !pub.unpublished_at && pub.visibility !== "private" && creator.handle) {
    const { data: rev } = pub.current_revision_id ? await db.from("published_revisions").select("version_id").eq("id", pub.current_revision_id).maybeSingle() : { data: null };
    published = { url: `${await siteOrigin()}/p/${creator.handle}/${pub.slug}`, newer: !!rev && rev.version_id !== (a.current_version_id ?? null) };
  }
  // Play-along (creative-room-parts.md, step 3): the other parts' kept takes, and a writing part's words on the Audio page.
  // part_takes returns only what this viewer may read; a short-lived media link is minted for exactly those.
  let playAlong: PlayAlong | null = null;
  if (part) {
    const takes = (await partTakes(db, part.project.id).catch(() => [])).filter((t) => t.partId !== part.part.id);
    const tracks = takes.flatMap((t) => {
      const url = mediaLink(t.storageObjectId);
      return url ? [{ partId: t.partId, title: t.title, versionNumber: t.versionNumber, url, seconds: t.seconds }] : [];
    });
    const lyric = at === "audio" ? part.others.find((o) => o.kind === "writing" && o.current) : undefined;
    const text = lyric ? await partWords(db, lyric.partId).catch(() => null) : null;
    const words = lyric && text?.current.content.trim() ? { partId: lyric.partId, title: lyric.title, versionNumber: text.current.number, text: text.current.content } : null;
    playAlong = tracks.length || words ? { tracks, words } : null;
  }
  const peopleIds = [creator.id, ...(contributors ?? []).map((c) => c.contributor_creator_id)];
  const avatars = await avatarUrls(db, peopleIds);
  const proposal = (pending ?? []).find((p) => (p.payload as { artifactId?: string }).artifactId === id);
  const def = artifactType(a.artifact_type);
  // Just made from another Creation (Change format): name it, so it's clear the original is untouched.
  const { data: madeFrom } = from && /^[0-9a-f-]{36}$/i.test(from) && from !== id ? await db.from("artifacts").select("id, title").eq("id", from).maybeSingle() : { data: null };
  const safeAdd = add && /^(material|creation|collection|comment|huddle_moment|conversation|conversation_reply|scrapbook_entry):[0-9a-f-]{36}$/i.test(add) ? add : null;
  return (
    <>
      {/* The Creation Palette during active work (palette-spec §9.16). */}
      <PaletteScope context={{ page: "studio", entityType: "creation", permissions: ["edit", "publish", "rights", "collaborate", "invite"], lifecycle: a.status === "in_review" ? "review" : a.status === "final" ? "finished" : a.status === "published" ? "published" : "in-progress", ids: { artifactId: id }, facts: { format: def.format, workPath: own, hasWords: !!version?.content?.trim(), published: !!published, suggestTo: part?.others.find((o) => o.canSuggest)?.title ?? null, ...(at === "write" ? { writingStyle: writingStyleOf(a.artifact_type) } : {}) }, strip: { version: version?.version_number, visibility: a.privacy as "private" | "shared" | "public" } }} />
      <Studio
        page={at === "write" ? "writing" : at === "image" ? "images" : at === "audio" ? "audio" : at === "deck" ? "presentation" : at === "video" ? "video" : "studio"}
        deck={deck ? { deck, pictures: slidePictures } : null}
        video={storyboard ? { storyboard, frames } : null}
        audio={at === "audio" ? { take: audioTake } : null}
        images={imageSet ? { set: imageSet, pictures } : null}
        published={published}
        artifact={{ id: a.id, title: a.title, type: a.artifact_type, typeLabel: def.label, format: def.format, status: a.status, coverUrl: covers[a.id] ?? null, look: lookOf(a.presentation, !!covers[a.id]), updatedAt: a.updated_at, ornament: ornamentOf(a.presentation) }}
        version={version ? { id: version.id, number: version.version_number, content: version.content } : null}
        actions={actionsFor(a.artifact_type)}
        initialAction={action ?? null}
        addOnOpen={safeAdd}
        madeFrom={madeFrom}
        people={[{ id: creator.id, name: creator.display_name, avatarUrl: avatars[creator.id] ?? null }, ...(contributors ?? []).map((c) => ({ id: c.contributor_creator_id, name: (c.creators as { display_name: string } | null)?.display_name ?? "Collaborator", avatarUrl: avatars[c.contributor_creator_id] ?? null }))]}
        carousel={carousel}
        quality={quality ? { reportId: quality.id, versionId: quality.version_id, checks: quality.checks as never, findings: findingsOf(quality) } : null}
        pendingProposal={
          proposal
            ? {
                id: proposal.id,
                preview: String((proposal.payload as { content?: string }).content ?? ""),
                baseVersionId: String((proposal.payload as { baseVersionId?: string }).baseVersionId ?? ""),
                quality: (proposal.payload as { quality?: { reportId: string; keys: string[]; titles: string[] } }).quality,
              }
            : null
        }
        offline={!providerReadiness().live}
        part={part}
        playAlong={playAlong}
      />
    </>
  );
}

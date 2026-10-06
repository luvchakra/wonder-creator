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
import type { AudioTakeView } from "./audio-canvas";
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
  // Stage two (performance.md: at most three dependent stages): everything about the Creation that needs only its row.
  const [{ data: version }, { data: quality }, { data: pending }, { data: contributors }, covers, carousel, part, { data: pub }, { data: madeFrom }] = await Promise.all([
    a.current_version_id ? db.from("artifact_versions").select("*").eq("id", a.current_version_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("quality_reports").select("*").eq("artifact_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("ai_proposals").select("id, payload, created_at").eq("status", "pending").eq("action", "apply_revision").order("created_at", { ascending: false }).limit(10),
    db.from("artifact_contributors").select("contributor_creator_id, creators!artifact_contributors_contributor_creator_id_fkey(display_name)").eq("artifact_id", id).limit(6),
    coverUrls(db, [a]),
    a.artifact_type === "carousel" ? carouselView({ db, service: serviceClient(), creatorId: creator.id }, id) : Promise.resolve(null),
    // A part of a Room's joint work (creative-room-parts.md, step 2): what it was made with, what moved on since.
    partContextFor(db, id, creator.id),
    // Published and reachable (creation-pages.md): the live link shows under the title; Preview says when newer words exist.
    db.from("published_works").select("slug, visibility, unpublished_at, current_revision_id").eq("artifact_id", id).maybeSingle(),
    // Just made from another Creation (Change format): name it, so it's clear the original is untouched.
    from && /^[0-9a-f-]{36}$/i.test(from) && from !== id ? db.from("artifacts").select("id, title").eq("id", from).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  // The Images page (creation-pages.md, step 2): the pictures and what was done to them, from the current version.
  const imageSet = at === "image" ? imageSetOf(version?.structured_content) : null;
  // The Presentation page (creation-pages.md, step 4): the deck, or the slides its outline makes.
  const deck = at === "deck" ? deckOf(version?.structured_content, version?.content ?? "") : null;
  const slideImageIds = [...new Set((deck?.slides ?? []).map((x) => x.image).filter((x): x is string => !!x))];
  // The Video page (creation-pages.md, step 5): the shots, and an address for each frame.
  const storyboard = at === "video" ? storyboardOf(version?.structured_content, version?.content ?? "") : null;
  const frameIds = [...new Set((storyboard?.shots ?? []).map((x) => x.frame).filter((x): x is string => !!x))];
  // The Audio page (creation-pages.md, step 3): the kept take, its address and its transcript (or why there isn't one).
  const audioSet = at === "audio" ? audioSetOf(version?.structured_content) : null;
  const take = audioSet?.take ?? null;
  const publishedLive = !!pub && !pub.unpublished_at && pub.visibility !== "private" && !!creator.handle;
  const lyric = part && at === "audio" ? part.others.find((o) => o.kind === "writing" && o.current) : undefined;
  const peopleIds = [creator.id, ...(contributors ?? []).map((c) => c.contributor_creator_id)];

  // Stage three: what the page's kind needs, all at once — the pictures' rows, the published revision, the other parts'
  // takes and words (play-along, creative-room-parts.md step 3), and the people's avatars.
  const materialIds = imageSet?.items.length ? imageSet.items.map((i) => i.materialId) : slideImageIds.length ? slideImageIds : frameIds.length ? frameIds : take ? [take.materialId, ...(audioSet?.mix ? [audioSet.mix.materialId] : [])] : [];
  const [{ data: mats }, { data: rev }, takes, text, avatars] = await Promise.all([
    materialIds.length ? db.from("creative_materials").select("id, title, storage_object_id, extracted_text, metadata, processing_state").in("id", materialIds) : Promise.resolve({ data: [] as never[] }),
    publishedLive && pub.current_revision_id ? db.from("published_revisions").select("version_id").eq("id", pub.current_revision_id).maybeSingle() : Promise.resolve({ data: null }),
    part ? partTakes(db, part.project.id).catch(() => []) : Promise.resolve([]),
    lyric ? partWords(db, lyric.partId).catch(() => null) : Promise.resolve(null),
    avatarUrls(db, peopleIds),
  ]);
  type Mat = { id: string; title: string | null; storage_object_id: string | null; extracted_text: string | null; metadata: unknown; processing_state: string | null };
  const rows = (mats ?? []) as Mat[];
  // Stage four, only when there are pictures or a take: their addresses.
  const urls = rows.length ? await signedUrlsFor(db, rows.map((m) => m.storage_object_id)).catch(() => ({}) as Record<string, string>) : {};
  const urlOf = (m: Mat) => (m.storage_object_id ? (urls[m.storage_object_id] ?? null) : null);

  let pictures: Record<string, { url: string | null; width: number | null; height: number | null; title: string | null }> = {};
  if (imageSet?.items.length) {
    pictures = Object.fromEntries(
      rows.map((m) => {
        const meta = (m.metadata ?? {}) as { width?: unknown; height?: unknown };
        return [m.id, { url: urlOf(m), width: typeof meta.width === "number" ? meta.width : null, height: typeof meta.height === "number" ? meta.height : null, title: m.title }];
      }),
    );
  }
  let slidePictures: Record<string, string | null> = {};
  if (slideImageIds.length) slidePictures = Object.fromEntries(rows.map((m) => [m.id, urlOf(m)]));
  let frames: Record<string, string | null> = {};
  if (frameIds.length) frames = Object.fromEntries(rows.map((m) => [m.id, urlOf(m)]));
  let audioTake: AudioTakeView | null = null;
  const m = take ? rows.find((r) => r.id === take.materialId) : undefined;
  if (take && m) {
    const meta = (m.metadata ?? {}) as { processingNote?: string; durationSeconds?: number };
    audioTake = {
      materialId: m.id,
      url: urlOf(m),
      seconds: take.seconds || meta.durationSeconds || 0,
      transcript: m.extracted_text?.trim() || null,
      note: meta.processingNote ?? null,
      done: ["ready", "understood", "failed"].includes(m.processing_state ?? ""),
      bed: audioSet?.bed ?? null,
      mix: audioSet?.mix ? { url: (() => { const x = rows.find((r) => r.id === audioSet.mix!.materialId); return x ? urlOf(x) : null; })(), seconds: audioSet.mix.seconds } : null,
    };
  }
  const published: { url: string; newer: boolean } | null = publishedLive ? { url: `${await siteOrigin()}/p/${creator.handle}/${pub.slug}`, newer: !!rev && rev.version_id !== (a.current_version_id ?? null) } : null;
  // part_takes returns only what this viewer may read; a short-lived media link is minted for exactly those.
  let playAlong: PlayAlong | null = null;
  if (part) {
    const tracks = takes
      .filter((t) => t.partId !== part.part.id)
      .flatMap((t) => {
        const url = mediaLink(t.storageObjectId);
        return url ? [{ partId: t.partId, title: t.title, versionNumber: t.versionNumber, url, seconds: t.seconds }] : [];
      });
    const words = lyric && text?.current.content.trim() ? { partId: lyric.partId, title: lyric.title, versionNumber: text.current.number, text: text.current.content } : null;
    playAlong = tracks.length || words ? { tracks, words } : null;
  }
  const proposal = (pending ?? []).find((p) => (p.payload as { artifactId?: string }).artifactId === id);
  const def = artifactType(a.artifact_type);
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

import { carouselView, findingsOf, providerReadiness } from "@wonder/creator-brain";
import { actionsFor, artifactType, creationPath, lookOf, ornamentOf } from "@wonder/creator-studio";
import { notFound, redirect } from "next/navigation";
import { PaletteScope } from "@/components/creative-palette";
import { avatarUrls } from "@/lib/avatars";
import { coverUrls } from "@/lib/covers";
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
export async function StudioScreen({ id, search, at }: { id: string; search: StudioSearch; at: "studio" | "write" }) {
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
  const [{ data: version }, { data: quality }, { data: pending }, { data: contributors }, covers, carousel] = await Promise.all([
    a.current_version_id ? db.from("artifact_versions").select("*").eq("id", a.current_version_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("quality_reports").select("*").eq("artifact_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("ai_proposals").select("id, payload, created_at").eq("status", "pending").eq("action", "apply_revision").order("created_at", { ascending: false }).limit(10),
    db.from("artifact_contributors").select("contributor_creator_id, creators!artifact_contributors_contributor_creator_id_fkey(display_name)").eq("artifact_id", id).limit(6),
    coverUrls(db, [a]),
    a.artifact_type === "carousel" ? carouselView({ db, service: serviceClient(), creatorId: creator.id }, id) : Promise.resolve(null),
  ]);
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
      <PaletteScope context={{ page: "studio", entityType: "creation", permissions: ["edit", "publish", "rights", "collaborate", "invite"], lifecycle: a.status === "in_review" ? "review" : a.status === "final" ? "finished" : a.status === "published" ? "published" : "in-progress", ids: { artifactId: id }, facts: { format: def.format, workPath: own }, strip: { version: version?.version_number, visibility: a.privacy as "private" | "shared" | "public" } }} />
      <Studio
        page={at === "write" ? "writing" : "studio"}
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
      />
    </>
  );
}

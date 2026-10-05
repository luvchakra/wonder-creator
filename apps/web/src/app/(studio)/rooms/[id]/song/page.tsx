import { mediaLink } from "@wonder/core/server";
import { getProject, listParts, mixNotes, partMix, partTakes, partWords, songAgreement, songOf } from "@wonder/creator-projects";
import { creationPath } from "@wonder/creator-studio";
import { notFound } from "next/navigation";
import { PaletteScope } from "@/components/creative-palette";
import { requireSession } from "@/lib/session";
import { ListenView } from "./listen-view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireSession();
  const { data } = /^[0-9a-f-]{36}$/i.test(id) ? await db.from("projects").select("title").eq("id", id).maybeSingle() : { data: null };
  return { title: data?.title ? `${data.title} · Listen together` : "Listen together" };
}

/**
 * Listen together (creative-room-parts.md, step 4): the Room's parts heard as one — each kept take at its start and
 * level, the words beneath, a download rendered in the browser. Whoever sees the Room listens to the takes they may
 * read (part_takes decides); the people making the work set the mix.
 */
export default async function ListenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const data = await getProject(db, id).catch(() => null);
  if (!data) notFound();
  const parts = await listParts(db, id, creator.id);
  if (!parts.length) notFound();
  const [takes, mix, role] = await Promise.all([
    partTakes(db, id).catch(() => []),
    partMix(db, id),
    db.rpc("project_role_of", { p_project: id }).then((r) => r.data as string | null),
  ]);
  const tracks = takes.flatMap((t) => {
    const url = mediaLink(t.storageObjectId);
    const part = parts.find((p) => p.id === t.partId);
    return url ? [{ partId: t.partId, title: t.title, versionNumber: t.versionNumber, url, seconds: t.seconds, people: (part?.people ?? []).filter((x) => x.status === "active").map((x) => (x.id === creator.id ? "you" : x.name)) }] : [];
  });
  const writing = parts.find((p) => p.kind === "writing" && p.artifact);
  const text = writing ? await partWords(db, writing.id).catch(() => null) : null;
  const words = writing && text?.current.content.trim() ? { partId: writing.id, title: writing.title, versionNumber: text.current.number, text: text.current.content } : null;
  const making = !!role || parts.some((p) => p.mine);
  const notes = await mixNotes(db, id, creator.id, role === "owner" || role === "admin");
  // Publishing the song together (step 5b): the Room's owner, once everyone has agreed the credits.
  const isOwner = data.project.creator_id === creator.id;
  const [agreement, songId] = isOwner ? await Promise.all([songAgreement(db, id), songOf(db, id)]) : [null, null];
  const { data: work } = songId ? await db.from("published_works").select("slug, visibility, unpublished_at").eq("artifact_id", songId).maybeSingle() : { data: null };
  const publish = isOwner
    ? {
        ready: !!agreement && agreement.status === "agreed" && agreement.holds,
        published: work && !work.unpublished_at && creator.handle ? { url: `/p/${creator.handle}/${work.slug}`, visibility: work.visibility } : null,
      }
    : null;
  const myPart = parts.find((x) => x.mine && x.artifact) ?? null;
  return (
    <>
      <PaletteScope
        context={{
          page: "room",
          entityType: "room",
          permissions: [],
          ids: { projectId: id },
          facts: { hasParts: true, myPartHref: myPart?.artifact ? creationPath(myPart.artifact.id, myPart.artifact.type) : null },
          strip: { label: `${parts.filter((x) => x.status === "final").length} of ${parts.length} parts final` },
        }}
      />
      <ListenView
        project={{ id, title: data.project.title }}
        parts={parts.map((p) => ({ id: p.id, title: p.title, kind: p.kind, status: p.status, versionNumber: p.artifact?.versionNumber ?? null, href: p.artifact ? creationPath(p.artifact.id, p.artifact.type) : null }))}
        tracks={tracks}
        mix={mix.tracks}
        words={words}
        making={making}
        notes={notes}
        publish={publish}
      />
    </>
  );
}

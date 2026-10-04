import { artifactType, creationPath, ornamentOf, writingStyleOf } from "@wonder/creator-studio";
import { WrittenPiece } from "@/components/writing/written-piece";
import { KIT } from "@wonder/ui";
import { X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Reading" };

/**
 * A Creation on a page of its own (owner, 3 Oct 2026: "option to open as a separate page, focus on the writing,
 * nothing else"): the title and the words on paper, full screen, with one way back. It covers the app chrome (top bar,
 * Palette, mini player) instead of leaving the app layout, so music keeps playing. The creator sees their latest
 * draft; collaborators see the current version. Access is the Creation's own (RLS).
 */
export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const { data: a } = await db.from("artifacts").select("id, title, artifact_type, creator_id, current_version_id, updated_at, presentation").eq("id", id).maybeSingle();
  if (!a) notFound();
  const mine = a.creator_id === creator.id;
  const [{ data: version }, { data: session }] = await Promise.all([
    a.current_version_id ? db.from("artifact_versions").select("content").eq("id", a.current_version_id).maybeSingle() : Promise.resolve({ data: null }),
    mine ? db.from("studio_sessions").select("draft, draft_saved_at").eq("artifact_id", id).eq("creator_id", creator.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const draftNewer = !!(session?.draft && session.draft_saved_at && session.draft_saved_at > a.updated_at);
  const text = (draftNewer ? session!.draft : version?.content) ?? "";
  const def = artifactType(a.artifact_type);
  const { data: author } = await db.from("creators").select("display_name").eq("id", a.creator_id).maybeSingle();
  const back = mine ? creationPath(id, a.artifact_type) : `/creations/${id}`;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-background" style={{ backgroundImage: `url(${KIT.texture.texturePaper.svg})`, backgroundSize: "512px" }}>
      <Link
        href={back}
        aria-label="Close reading"
        className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 inline-flex size-11 items-center justify-center rounded-full bg-surface/80 text-ink-muted shadow-[var(--shadow-card)] backdrop-blur hover:text-ink"
      >
        <X className="size-5" aria-hidden />
      </Link>
      <article className="mx-auto max-w-[38rem] px-6 pb-[max(4rem,env(safe-area-inset-bottom))] pt-[max(4.5rem,env(safe-area-inset-top))] sm:pt-24">
        {/* Set the way its kind is best read: a poem, an essay, news… (creation-pages.md §Writing kinds). */}
        <WrittenPiece style={writingStyleOf(a.artifact_type)} kicker={def.label} title={a.title || "Untitled"} text={text} byline={author?.display_name} date={a.updated_at} ornament={ornamentOf(a.presentation)} as="h1" empty="Nothing written yet." />
      </article>
    </div>
  );
}

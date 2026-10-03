import { artifactType } from "@wonder/creator-studio";
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
  const { data: a } = await db.from("artifacts").select("id, title, artifact_type, creator_id, current_version_id, updated_at").eq("id", id).maybeSingle();
  if (!a) notFound();
  const mine = a.creator_id === creator.id;
  const [{ data: version }, { data: session }] = await Promise.all([
    a.current_version_id ? db.from("artifact_versions").select("content").eq("id", a.current_version_id).maybeSingle() : Promise.resolve({ data: null }),
    mine ? db.from("studio_sessions").select("draft, draft_saved_at").eq("artifact_id", id).eq("creator_id", creator.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const draftNewer = !!(session?.draft && session.draft_saved_at && session.draft_saved_at > a.updated_at);
  const text = (draftNewer ? session!.draft : version?.content) ?? "";
  const def = artifactType(a.artifact_type);
  const verse = def.format === "verse";
  const back = mine ? `/creations/${id}/studio` : `/creations/${id}`;

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
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">{def.label}</p>
        <h1 className="mt-2 font-display text-[34px] leading-[1.1] text-ink [text-wrap:balance] sm:text-[44px]">{a.title || "Untitled"}</h1>
        <div aria-hidden className="mt-5 h-px w-16 bg-ink/15" />
        <div className={verse ? "mt-7 whitespace-pre-wrap font-display text-[20px] leading-9 text-ink" : "mt-7 whitespace-pre-wrap font-display text-[19px] leading-[1.75] text-ink"}>
          {text.trim() ? text : <span className="text-ink-subtle">Nothing written yet.</span>}
        </div>
      </article>
    </div>
  );
}

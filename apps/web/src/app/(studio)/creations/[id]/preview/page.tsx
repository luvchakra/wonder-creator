import { creationPath } from "@wonder/creator-studio";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound, redirect } from "next/navigation";
import { PublishedWorkPage } from "@/components/publish/work-page";
import { loadWorkPreview, siteOrigin } from "@/lib/public-pages";
import { requireSession } from "@/lib/session";
import { PreviewBar } from "./preview-bar";

export const metadata = { title: "Preview" };

/**
 * Preview (owner, 4 Oct 2026: "show the same to user as a prominent preview option so they understand what can happen
 * next"): the Creation exactly as its public page would show it — the same renderer readers get — with one bar beneath:
 * Publish as link, or the live link once it's published. It covers the app chrome like Read does; one way back.
 */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const { data: a } = await db.from("artifacts").select("id, artifact_type, creator_id, current_version_id").eq("id", id).maybeSingle();
  if (!a) notFound();
  if (a.creator_id !== creator.id) redirect(`/creations/${id}`);
  const origin = await siteOrigin();
  const p = await loadWorkPreview(db, { id: creator.id, handle: creator.handle, name: creator.display_name, avatarObjectId: creator.avatar_object_id }, id);
  const back = creationPath(id, a.artifact_type);
  // Words written since the last version live in the Studio's autosaved draft; Preview shows versions, so say so.
  const { data: draft } = await db.from("studio_sessions").select("draft, draft_base_version_id").eq("artifact_id", id).eq("creator_id", creator.id).not("draft", "is", null).limit(1).maybeSingle();
  const unsaved = !!draft?.draft && (!draft.draft_base_version_id || draft.draft_base_version_id === a.current_version_id);
  const url = creator.handle ? `${origin}/p/${creator.handle}/${p.view.slug}` : null;
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-background">
      {/* Closing returns to where Preview was opened from: the Writing page, the Creation page… (back-navigation.md). */}
      <BackLink variant="close" home={back} homeLabel="writing" />
      <div className="pb-28">
        {unsaved ? (
          <p role="status" className="mx-auto mt-16 max-w-2xl rounded-2xl bg-[#fff4e5] px-4 py-2.5 text-[14px] text-ink">
            You have newer words that aren&rsquo;t saved as a version yet, so they aren&rsquo;t shown here.{" "}
            <Link href={back} className="font-medium text-accent-ink underline">
              Go back and save them
            </Link>
            .
          </p>
        ) : null}
        {p.empty ? (
          <p className="mx-auto max-w-md px-6 pt-24 text-center font-display text-[20px] text-ink-muted">Nothing to show yet — write or add something first.</p>
        ) : (
          <PublishedWorkPage work={p.view} url={url ?? ""} />
        )}
      </div>
      <PreviewBar artifactId={id} back={back} url={url} published={p.published} changed={p.changedSincePublished} empty={p.empty} />
    </div>
  );
}

import { followList, getCreatorByHandle } from "@wonder/creator-identity";
import { Avatar, BACKGROUNDS, BrandBackground } from "@wonder/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaletteScope } from "@/components/creative-palette";
import { avatarUrls } from "@/lib/avatars";
import { requireSession } from "@/lib/session";
import { FollowButton } from "./follow-button";

/** Followers / Following for a Profile: people the viewer may see, newest first, with a Follow toggle for each. */
export async function FollowListPage({ handle, kind, before }: { handle: string; kind: "followers" | "following"; before?: string }) {
  if (!/^[a-z0-9_]{3,30}$/i.test(handle)) notFound();
  const { db, creator: me } = await requireSession();
  const profile = await getCreatorByHandle(db, handle);
  if (!profile) notFound();
  const c = profile.creator;
  const { people, nextBefore } = await followList(db, c.id, kind, { before: before && !Number.isNaN(Date.parse(before)) ? before : null });
  const avatars = await avatarUrls(db, people.map((p) => p.id));
  const name = c.display_name || c.handle || "Creator";
  const base = `/creators/${c.handle}`;
  const title = kind === "followers" ? "Followers" : "Following";
  return (
    <>
      <PaletteScope context={{ page: c.id === me.id ? "me" : "creator" }} />
      <div className="mx-auto max-w-2xl space-y-3">
        <BrandBackground src={BACKGROUNDS.mistyMountains} overlay="none" className="-mx-4 h-20 sm:-mx-6 lg:mx-0 lg:rounded-3xl" />
        <header className="relative z-10 -mt-10 flex items-center gap-3 rounded-2xl bg-surface/95 px-2 py-2 shadow-[var(--shadow-card)] backdrop-blur-sm">
          <Link href={base} aria-label={`Back to ${name}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface-muted">
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-[22px] leading-tight text-ink">{title}</h1>
            <p className="truncate text-[12.5px] text-ink-muted">{name}</p>
          </div>
        </header>
        <nav aria-label="Followers and following" className="flex gap-1.5 px-1">
          {(["followers", "following"] as const).map((k) => (
            <Link key={k} href={`${base}/${k}`} aria-current={k === kind ? "page" : undefined} className="inline-flex min-h-11 items-center">
              <span className={k === kind ? "inline-flex h-8 items-center rounded-full bg-accent-soft px-3 text-[13px] font-medium text-accent-ink" : "inline-flex h-8 items-center rounded-full px-3 text-[13px] text-ink-muted hover:bg-surface"}>{k === "followers" ? "Followers" : "Following"}</span>
            </Link>
          ))}
        </nav>
        {people.length ? (
          <ul aria-label={title} className="divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface shadow-[var(--shadow-card)]">
            {people.map((p) => (
              <li key={p.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
                <Avatar name={p.name} src={avatars[p.id]} size={40} />
                <Link href={p.handle ? `/creators/${p.handle}` : "#"} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate font-display text-[15px] text-ink">{p.name}</span>
                  {p.handle ? <span className="block truncate text-[12px] text-ink-subtle">@{p.handle}</span> : null}
                </Link>
                {p.id !== me.id ? <FollowButton creatorId={p.id} name={p.name} initial={p.iFollow} /> : <span className="text-[12px] text-ink-subtle">You</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-border-soft bg-surface px-4 py-6 text-center text-[13.5px] text-ink-muted">{kind === "followers" ? "No followers yet." : "Not following anyone yet."}</p>
        )}
        {nextBefore ? (
          <Link href={`${base}/${kind}?before=${encodeURIComponent(nextBefore)}`} className="mx-auto flex min-h-11 w-fit items-center text-[13.5px] font-medium text-accent-ink hover:underline">
            Show more
          </Link>
        ) : null}
      </div>
    </>
  );
}

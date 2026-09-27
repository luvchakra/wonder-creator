import { collaborationProfileOf, getCreatorByHandle } from "@wonder/creator-identity";
import { EXCLUSIVITY, WORK_MODES } from "@wonder/creator-identity/collaboration-options";
import { liveCards } from "@wonder/creator-huddle";
import { canMessage } from "@wonder/creator-projects";
import { Avatar, Badge, EmptyState, BACKGROUNDS, BrandBackground, buttonClasses } from "@wonder/ui";
import { MapPin, PenLine } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtifactCard } from "@/components/cards";
import { LiveHuddleCard } from "@/components/huddle/live-card";
import { avatarUrls } from "@/lib/avatars";
import { coverUrls } from "@/lib/covers";
import { listPosts } from "@wonder/creator-library";
import { ScrapbookPostCard } from "@/components/scrapbook-post";
import { requireSession } from "@/lib/session";
import { ProfileActions } from "./profile-actions";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return { title: `@${handle.slice(0, 30)}` };
}

const AVAILABILITY: Record<string, string> = { open: "Open to collaborate", selective: "Selectively collaborating", closed: "Not collaborating right now" };

export default async function CreatorProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  if (!/^[a-z0-9_]{3,30}$/i.test(handle)) notFound();
  const { db, creator: me } = await requireSession();
  const profile = await getCreatorByHandle(db, handle); // RLS decides whether this profile is visible
  if (!profile) notFound();
  const c = profile.creator;
  const isMe = c.id === me.id;

  // Own profile shows everything you own; others see only public, final work.
  let q = db.from("artifacts").select("id, title, artifact_type, status, updated_at, cover_material_id, privacy, featured_on_profile").eq("creator_id", c.id).neq("status", "archived").order("featured_on_profile", { ascending: false }).order("updated_at", { ascending: false }).limit(12);
  if (!isMe) q = q.eq("privacy", "public").in("status", ["final", "published"]);
  const [{ data: artifacts }, live, myLive, follow, avatars, messageable, collab] = await Promise.all([
    q,
    liveCards(db, { creatorId: c.id, limit: 3 }),
    isMe ? Promise.resolve([]) : liveCards(db, { creatorId: me.id, limit: 1 }),
    isMe ? Promise.resolve({ data: null }) : db.from("creator_follows").select("followed_creator_id").eq("follower_creator_id", me.id).eq("followed_creator_id", c.id).maybeSingle(),
    avatarUrls(db, [c.id]),
    isMe ? Promise.resolve(false) : canMessage(db, c.id),
    collaborationProfileOf(db, c.id).catch(() => null),
  ]);
  const [covers, scrapbook] = await Promise.all([coverUrls(db, artifacts ?? []), listPosts(db, me.id, { scope: "creator", authorId: c.id }, { limit: 3 })]);

  return (
    <div className="space-y-8">
      <BrandBackground src={BACKGROUNDS.mistyMountains} overlay="soft" className="-mx-4 h-40 sm:-mx-6 sm:h-48 lg:mx-0 lg:rounded-3xl" />
      <section className="-mt-24 grid gap-6 px-1 lg:grid-cols-[1fr_320px]">
        <div>
          <Avatar name={c.display_name || c.handle || "Creator"} src={avatars[c.id]} size={112} className="relative z-10 border-4 border-cream" />
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="break-words font-display text-3xl text-ink sm:text-4xl">{c.display_name || "Creator"}</h1>
              <p className="text-ink-subtle">@{c.handle}</p>
            </div>
            {isMe ? (
              <Link href="/settings" className={buttonClasses({ variant: "secondary" })}>
                <PenLine className="size-4" aria-hidden /> Edit profile
              </Link>
            ) : (
              <ProfileActions creatorId={c.id} following={!!follow.data} myLiveHuddleId={myLive[0]?.huddleId ?? null} canMessage={messageable} />
            )}
          </div>
          {profile.disciplines.length ? <p className="mt-2 text-ink-muted">{profile.disciplines.join(" · ")}</p> : null}
          {c.bio ? <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink">{c.bio}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            {c.show_location && c.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" aria-hidden /> {c.location}
              </span>
            ) : null}
            {profile.languages.length ? <span>Creates in {profile.languages.join(", ")}</span> : null}
            <Badge tone={c.collaboration_availability === "open" ? "success" : "neutral"}>{AVAILABILITY[c.collaboration_availability]}</Badge>
          </div>
          {profile.skills.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {profile.skills.map((s) => (
                <Badge key={s} tone="accent">
                  {s}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <aside className="space-y-3 lg:pt-28">
          <h2 className="text-sm font-semibold text-ink-muted">Live presence</h2>
          {live.length ? (
            live.map((h) => <LiveHuddleCard key={h.huddleId} h={h} />)
          ) : (
            <p className="rounded-2xl border border-border-soft bg-surface px-4 py-3 text-sm text-ink-muted">{isMe ? "You're not in a public Huddle right now." : "Not in a public Huddle right now."}</p>
          )}
        </aside>
      </section>

      {collab && (collab.hasProfile || isMe) && collab.availability !== "closed" ? <HowICollaborate p={collab} isMe={isMe} /> : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">{isMe ? "Your work" : "Selected work"}</h2>
        {artifacts?.length ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {artifacts.map((a) => (
              <li key={a.id}>
                <ArtifactCard a={{ ...a, coverUrl: covers[a.id] ?? null }} />
                {isMe && a.privacy !== "public" ? <p className="mt-1 text-xs text-ink-subtle">Private — only you can see this</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState image={BACKGROUNDS.studioDesk} title={isMe ? "Nothing to show yet" : "No public work yet"} body={isMe ? "Mark a Creation as final and public to share it on your profile." : "When this creator shares finished work, it will appear here."} />
        )}
      </section>

      <section aria-labelledby="scrapbook-h">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="scrapbook-h" className="text-lg font-semibold text-ink">
            Scrapbook
          </h2>
          <Link href="/scrapbook" className="text-sm font-medium text-accent-ink hover:underline">
            {isMe ? "Share something" : "Open Scrapbook"}
          </Link>
        </div>
        {scrapbook.posts.length ? (
          <ol className="space-y-3">
            {scrapbook.posts.map((p) => (
              <li key={p.id}>
                <ScrapbookPostCard post={p} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[15px] text-ink-muted">{isMe ? "Thoughts, reflections and sketches you share appear here." : "Nothing shared here yet."}</p>
        )}
      </section>
    </div>
  );
}

/** "How I collaborate" (P1-14): only what the creator filled in; rate guidance only when they chose to show it. */
function HowICollaborate({ p, isMe }: { p: NonNullable<Awaited<ReturnType<typeof collaborationProfileOf>>>; isMe: boolean }) {
  const rows: Array<[string, string]> = [
    ...(p.projectTypes.length ? ([["Project types", p.projectTypes.join(", ")]] as Array<[string, string]>) : []),
    ...(p.interests.length ? ([["Interested in", p.interests.join(", ")]] as Array<[string, string]>) : []),
    ["Works", `${WORK_MODES.find((m) => m.value === p.workMode)?.label ?? p.workMode}${p.region ? ` · ${p.region}` : ""}`],
    ...(p.turnaround ? ([["Typical turnaround", p.turnaround]] as Array<[string, string]>) : []),
    ["Exclusivity", EXCLUSIVITY.find((m) => m.value === p.exclusivity)?.label ?? p.exclusivity],
    ...(p.commercialBoundaries ? ([["Won't take on", p.commercialBoundaries]] as Array<[string, string]>) : []),
    ...(p.rightsPreferences ? ([["Rights", p.rightsPreferences]] as Array<[string, string]>) : []),
    ...(p.rateGuidance ? ([["Rate guidance", p.rateGuidance]] as Array<[string, string]>) : []),
  ];
  return (
    <section aria-labelledby="collab-h" className="rounded-2xl border border-border-soft bg-[image:var(--gradient-card)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="collab-h" className="text-lg font-semibold text-ink">
          How {isMe ? "you" : "I"} collaborate
        </h2>
        {isMe ? (
          <Link href="/settings?section=collaboration" className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">
            {p.hasProfile ? "Edit" : "Add how you like to collaborate"}
          </Link>
        ) : null}
      </div>
      <dl className="mt-2 grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-[auto_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-subtle">{k}</dt>
            <dd className="text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      {p.contactPreference === "network" && !isMe ? <p className="mt-3 text-sm text-ink-muted">Takes messages and invitations from people they&rsquo;ve worked with.</p> : null}
    </section>
  );
}

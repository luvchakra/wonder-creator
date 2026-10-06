import { OPEN_TO_LABEL, listConversations, openToOf } from "@wonder/creator-community";
import { brandSummaryOf, canWriteTestimonial, collaborationProfileOf, followCounts, getCreatorByHandle, sharedContexts, testimonialsOf } from "@wonder/creator-identity";
import { liveCards } from "@wonder/creator-huddle";
import { listPosts } from "@wonder/creator-library";
import { canMessage } from "@wonder/creator-projects";
import { PROFILE_SHELVES, type ProfileShelf } from "@wonder/creator-studio/types";
import { Avatar, BACKGROUNDS, BrandBackground, chipBase, cn } from "@wonder/ui";
import { Briefcase, Globe2, MapPin, PenLine, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PaletteScope } from "@/components/creative-palette";
import { ShareProfile } from "@/components/profile/client";
import { CommunityTab } from "@/components/profile/community";
import { CreationsTab } from "@/components/profile/creations";
import { MomentsTab } from "@/components/profile/moments";
import { OverviewTab } from "@/components/profile/overview";
import { AlbumPreview } from "@/components/profile/album";
import { TestimonialsSection } from "@/components/profile/testimonials";
import { albumOf } from "@/lib/album";
import { surface } from "@/components/profile/shared";
import { avatarUrls } from "@/lib/avatars";
import { profileCreations } from "@/lib/profile";
import { loadCreatorPage } from "@/lib/public-pages";
import { flagOn } from "@/lib/features";
import { requireSession } from "@/lib/session";
import { ProfileActions } from "./profile-actions";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return { title: `@${handle.slice(0, 30)}` };
}

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "creations", label: "Creations" },
  { value: "moments", label: "Moments" },
  { value: "community", label: "Pulse" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const AVAILABILITY: Record<string, string> = { open: "Open to collaborate", selective: "Selectively collaborating", closed: "Not collaborating right now" };

/**
 * A creator's Profile (profile board, 30 Sep 2026): identity at a glance, then four views of the same person —
 * Overview, Creations, Moments and Community. Only the chosen view's data is read. Your own Profile shows what you own;
 * others see only what they may (RLS decides every read). No follower or like counts, ever.
 */
export default async function CreatorProfilePage({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<{ tab?: string; shelf?: string }> }) {
  const [{ handle }, sp] = await Promise.all([params, searchParams]);
  if (!/^[a-z0-9_]{3,30}$/i.test(handle)) notFound();
  const tab: Tab = TABS.some((t) => t.value === sp.tab) ? (sp.tab as Tab) : "overview";
  const shelf = (PROFILE_SHELVES.some((s) => s.value === sp.shelf) ? sp.shelf : "all") as ProfileShelf | "all";
  const { db, creator: me } = await requireSession();
  const profile = await getCreatorByHandle(db, handle); // RLS decides whether this profile is visible
  if (!profile) notFound();
  const c = profile.creator;
  const isMe = c.id === me.id;
  const base = `/creators/${c.handle}`;
  const name = c.display_name || c.handle || "Creator";

  // Everything below needs only the profile, so it all starts now and overlaps (docs/performance.md, phase 5); the
  // awaits further down only collect it. It was seven stages in a row.
  const testimonialsOn = flagOn("testimonials_enabled");
  const testimonialsP = testimonialsOn
    ? Promise.all([testimonialsOf(db, c.id).catch(() => []), isMe ? Promise.resolve(false) : canWriteTestimonial(db, me.id, c.id).catch(() => false)])
    : Promise.resolve([[] as Awaited<ReturnType<typeof testimonialsOf>>, false] as const);
  const albumP = tab === "overview" && flagOn("photo_album_enabled") ? albumOf(db, c.id, 5).catch(() => []) : Promise.resolve([]);
  const overviewP =
    tab === "overview"
      ? Promise.all([
          collaborationProfileOf(db, c.id).catch(() => null),
          openToOf(db, [c.id])
            .then((m) => m.get(c.id) ?? [])
            .catch(() => []),
          profileCreations(db, c.id, isMe, 24),
          listPosts(db, me.id, { scope: "creator", authorId: c.id }, { limit: 12 }).catch(() => ({ posts: [] })),
        ])
      : null;
  const creationsP = tab === "creations" ? profileCreations(db, c.id, isMe) : null;
  const momentsP = tab === "moments" ? listPosts(db, me.id, { scope: "creator", authorId: c.id }, { limit: 30 }) : null;
  void albumP.catch(() => undefined);
  void creationsP?.catch(() => undefined);
  void momentsP?.catch(() => undefined);

  const [live, myLive, follow, avatars, brand, messageable, counts] = await Promise.all([
    liveCards(db, { creatorId: c.id, limit: 3 }).catch(() => []),
    isMe ? Promise.resolve([]) : liveCards(db, { creatorId: me.id, limit: 1 }).catch(() => []),
    isMe ? Promise.resolve({ data: null }) : db.from("creator_follows").select("followed_creator_id").eq("follower_creator_id", me.id).eq("followed_creator_id", c.id).maybeSingle(),
    avatarUrls(db, [c.id]),
    brandSummaryOf(db, c.id).catch(() => null),
    isMe ? Promise.resolve(false) : canMessage(db, c.id),
    followCounts(db, c.id).catch(() => null),
  ]);

  // Testimonials (docs/testimonials.md): what others wrote, once this creator chose to show it.
  const [testimonials, canWrite] = await testimonialsP;
  const [shared, testimonialAvatars] = await Promise.all([
    canWrite || testimonials.some((t) => t.from.id === me.id) ? sharedContexts(db, me.id, c.id).catch(() => []) : Promise.resolve([]),
    testimonials.length ? avatarUrls(db, testimonials.map((t) => t.from.id)).catch(() => ({}) as Record<string, string>) : Promise.resolve({} as Record<string, string>),
  ]);
  const testimonialsBlock = testimonialsOn ? (
    <TestimonialsSection items={testimonials} isMe={isMe} viewerId={me.id} creator={{ id: c.id, name, handle: c.handle ?? handle }} avatars={testimonialAvatars} canWrite={canWrite} shared={shared} base={base} limit={tab === "overview" ? 2 : undefined} />
  ) : null;

  // Photo album (docs/photo-album.md): a glimpse on the Overview; the whole album has its own page.
  const album = await albumP;
  const albumBlock = tab === "overview" && flagOn("photo_album_enabled") ? <AlbumPreview photos={album} href={`${base}/album`} isMe={isMe} /> : null;

  let body: ReactNode = null;
  if (tab === "overview") {
    const [collab, openTo, creations, scrap] = await overviewP!;
    const series = creations.filter((x) => x.shelf === "series");
    const glimpses = scrap.posts
      .map((p) => {
        const img = p.attachments.find((a) => a.fileUrl && a.mimeType?.startsWith("image/"));
        return { id: p.id, imageUrl: img?.fileUrl ?? null, text: p.body.trim() || p.attachments[0]?.title || "" };
      })
      .filter((g) => g.imageUrl || g.text);
    // Pictures lead; words fill in when there aren't four.
    const ordered = [...glimpses.filter((g) => g.imageUrl), ...glimpses.filter((g) => !g.imageUrl)].slice(0, 4);
    const lines = [profile.languages.length ? `Creates in ${profile.languages.join(", ")}` : null].filter((x): x is string => !!x);
    body = (
      <OverviewTab
        base={base}
        isMe={isMe}
        about={{ lines, skills: profile.skills, openTo: openTo.map((o) => OPEN_TO_LABEL[o]) }}
        brand={brand}
        collab={collab}
        series={series}
        glimpses={ordered}
        before={albumBlock}
        after={testimonialsBlock}
      />
    );
  } else if (tab === "creations") {
    body = <CreationsTab base={base} shelf={shelf} items={await creationsP!} isMe={isMe} />;
  } else if (tab === "moments") {
    const { posts } = await momentsP!;
    body = <MomentsTab posts={posts} isMe={isMe} />;
  } else {
    const [convs, page] = await Promise.all([listConversations(db, me.id, { authorId: c.id, limit: 8 }).catch(() => ({ cards: [] })), c.handle ? loadCreatorPage(c.handle).catch(() => null) : Promise.resolve(null)]);
    body = (
      <div className="space-y-2.5">
        <div id="testimonials">{testimonialsBlock}</div>
        <CommunityTab huddles={live} conversations={convs.cards.map((x) => x.conversation)} shared={(page?.works ?? []).slice(0, 3)} handle={c.handle ?? handle} isMe={isMe} pagePublished={!!page} />
      </div>
    );
  }

  const pill = "relative inline-flex min-h-8 min-w-0 items-center justify-center gap-1 rounded-full py-1 text-center leading-tight max-[379px]:[&>svg]:hidden border border-border-soft bg-surface px-1 text-[12px] font-medium text-accent-ink before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] hover:bg-accent-softer";
  const isLive = live.length > 0;

  return (
    <>
      <PaletteScope context={{ page: isMe ? "me" : "creator", ids: { creatorHandle: c.handle ?? handle }, facts: { canWrite: canWrite && !testimonials.some((t) => t.from.id === me.id) } }} />
      <div className="mx-auto max-w-3xl space-y-3">
        <BrandBackground src={BACKGROUNDS.mistyMountains} overlay="none" position="center 40%" className="-mx-4 h-36 sm:-mx-6 sm:h-44 lg:mx-0 lg:rounded-3xl" />
        <section aria-label="Profile" className={cn(surface, "relative -mt-16 rounded-3xl bg-surface/95 px-3.5 pb-3.5 pt-3.5 backdrop-blur-sm")}>
          <div className="flex items-center gap-3">
            <span className="relative shrink-0">
              <Avatar name={name} src={avatars[c.id]} size={64} className="border-[3px] border-surface shadow-[0_4px_14px_-4px_rgb(107_91_149/0.35)]" />
              {isLive ? (
                <span className="absolute bottom-0.5 right-0.5 size-3.5 rounded-full border-2 border-surface bg-success" role="img" aria-label="In a live Huddle now" />
              ) : null}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="break-words font-display text-[23px] leading-tight text-ink">{name}</h1>
              <p className="line-clamp-2 text-[12.5px] leading-snug text-ink-muted">
                <span>@{c.handle}</span>
                {profile.disciplines.length ? <span> · {profile.disciplines.join(" · ")}</span> : null}
              </p>
            </div>
          </div>
          {c.bio ? <p className="mt-2 line-clamp-3 text-[13.5px] leading-snug text-ink">{c.bio}</p> : null}
          <ul aria-label="At a glance" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-muted">
            {c.show_location && c.location ? (
              <li className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden /> {c.location}
              </li>
            ) : null}
            <li className="inline-flex items-center gap-1">
              <Sparkles className="size-3.5" aria-hidden /> {AVAILABILITY[c.collaboration_availability]}
            </li>
            {brand ? (
              <li className="inline-flex items-center gap-1">
                <Briefcase className="size-3.5" aria-hidden /> Open to brand work
              </li>
            ) : null}
          </ul>
          {counts ? (
            <p aria-label="Followers and following" className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
              <Link href={`${base}/followers`} className="relative before:absolute before:-inset-y-3 before:inset-x-0 before:content-[''] hover:underline">
                <span className="font-semibold text-ink tabular-nums">{counts.followers}</span> {counts.followers === 1 ? "follower" : "followers"}
              </Link>
              <Link href={`${base}/following`} className="relative before:absolute before:-inset-y-3 before:inset-x-0 before:content-[''] hover:underline">
                <span className="font-semibold text-ink tabular-nums">{counts.following}</span> following
              </Link>
              {!isMe && counts.followsMe ? <span className="rounded-full bg-accent-softer px-2 py-0.5 text-[11.5px] text-accent-ink">Follows you</span> : null}
            </p>
          ) : null}
          <div className={cn("mt-2.5", isMe ? "grid grid-cols-3 gap-1.5" : "flex flex-wrap items-center gap-2")}>
            {isMe ? (
              <>
                <Link href="/settings" className={pill}>
                  <PenLine className="size-3 shrink-0" aria-hidden /> Edit profile
                </Link>
                <ShareProfile name={name} path={base} className={pill} />
                {/* The public home is curated separately from this Profile (CreatorPublish §39). */}
                <Link href="/creator-page" className={pill}>
                  <Globe2 className="size-3 shrink-0" aria-hidden /> Creator Page
                </Link>
              </>
            ) : (
              <ProfileActions creatorId={c.id} following={!!follow.data} myLiveHuddleId={myLive[0]?.huddleId ?? null} canMessage={messageable} />
            )}
          </div>
        </section>

        <nav aria-label="Profile views">
          <span className="grid grid-cols-4 gap-0.5 rounded-full bg-surface p-1 shadow-[0_3px_12px_-4px_rgb(107_91_149/0.16)]">
            {TABS.map((t) => (
              <Link
                key={t.value}
                href={t.value === "overview" ? base : `${base}?tab=${t.value}`}
                scroll={false}
                aria-current={t.value === tab ? "page" : undefined}
                className={cn(chipBase, "justify-center px-1 text-[12.5px] font-medium", t.value === tab ? "bg-[image:var(--gradient-primary)] text-white" : "text-accent-ink hover:bg-accent-softer")}
              >
                {t.label}
              </Link>
            ))}
          </span>
        </nav>

        <div className="pb-6">{body}</div>
      </div>
    </>
  );
}

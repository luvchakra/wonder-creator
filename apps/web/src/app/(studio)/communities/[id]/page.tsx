import { communityHuddles, communityMembers, communityTopics, getCommunity, INTENT_LABEL, type CommunityMember } from "@wonder/creator-community";
import { listSharedItems } from "@wonder/creator-projects";
import { Avatar, AvatarStack, EmptyState, KIT, KitArt, cn } from "@wonder/ui";
import { AudioLines, ChevronRight, FileText, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RelativeTime } from "@/components/client-time";
import { CommunityArt } from "@/components/community/community-art";
import { JoinCommunityButton, RemoveTopicButton, StartTopicButton } from "@/components/community/community-actions";
import { PaletteScope } from "@/components/creative-palette";
import { avatarUrls } from "@/lib/avatars";
import { communityCovers } from "@/lib/communities";
import { flagOn } from "@/lib/features";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Community" };

const VIEWS = ["forum", "creations", "huddles", "members"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABEL: Record<View, string> = { forum: "Forum", creations: "Creations", huddles: "Huddles", members: "Members" };
const ROLE: Record<CommunityMember["access"], string> = { owner: "Owner", admin: "Moderator", member: "Member" };

/**
 * One community (docs/communities.md): a discoverable Creative Room seen as Orkut saw a community — its Forum of topics,
 * the Creations members share, the Huddles started from its topics, and its Members. Anyone signed in may look and join;
 * members start topics. Ordered by latest activity; no counts of likes or followers, no ranking.
 */
export default async function CommunityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  if (!flagOn("communities_enabled")) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const view: View = (VIEWS as readonly string[]).includes(sp.view ?? "") ? (sp.view as View) : "forum";
  const { db, creator } = await requireSession();
  const community = await getCommunity(db, id).catch(() => null);
  if (!community) notFound();

  const [members, topics, huddles, shared, covers] = await Promise.all([
    communityMembers(db, id).catch(() => []),
    view === "forum" ? communityTopics(db, id).catch(() => []) : Promise.resolve([]),
    view === "huddles" ? communityHuddles(db, id).catch(() => []) : Promise.resolve([]),
    view === "creations" && community.isMember ? listSharedItems(db, id).catch(() => []) : Promise.resolve([]),
    communityCovers([community.coverMaterialId]),
  ]);
  const hosts = members.filter((m) => m.access !== "member");
  const avatars = await avatarUrls(db, members.slice(0, view === "members" ? 200 : 6).map((m) => m.id)).catch(() => ({}) as Record<string, string>);
  const coverUrl = community.coverMaterialId ? (covers[community.coverMaterialId] ?? null) : null;
  const viewerIsOwner = creator.id === community.owner.id;
  const moderators = hosts.filter((h) => h.access === "admin");

  return (
    <>
      <PaletteScope context={{ page: "community", ids: { projectId: id }, facts: { member: community.isMember, host: community.isHost }, strip: { label: `${community.title} · Community` } }} />
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href="/community?filter=communities" className="inline-flex min-h-11 items-center gap-1 text-[13.5px] text-ink-muted hover:text-ink">
          <ChevronRight className="size-4 rotate-180" aria-hidden /> Communities
        </Link>

        <header className="relative overflow-hidden rounded-3xl shadow-[var(--shadow-lift)]">
          <CommunityArt id={id} coverUrl={coverUrl} className="h-[200px] w-full sm:h-[240px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1e1b4b]/75 via-[#1e1b4b]/20 to-transparent" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 space-y-1 p-4 text-white sm:p-5">
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-white/80">Open community</p>
            <h1 className="break-words font-display text-[30px] leading-[1.1] [text-wrap:balance] sm:text-[38px]">{community.title}</h1>
          </div>
        </header>

        <section aria-label="About this community" className="space-y-3">
          {community.brief ? <p className="whitespace-pre-line font-display text-[16.5px] italic leading-snug text-ink-muted">{community.brief}</p> : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <AvatarStack people={members.slice(0, 5).map((m) => ({ name: m.name, src: avatars[m.id] ?? null }))} size={28} max={5} />
            <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-subtle">
              Owner <span className="text-ink">{community.owner.name}</span>
              {moderators.length ? (
                <>
                  {" "}
                  · Moderators <span className="text-ink">{moderators.map((m) => m.name.split(" ")[0]).join(", ")}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {community.isMember ? <StartTopicButton communityId={id} title={community.title} /> : <JoinCommunityButton id={id} joined={false} />}
          </div>
        </section>

        <nav aria-label="Community" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {VIEWS.map((v) => (
            <Link key={v} href={v === "forum" ? `/communities/${id}` : `/communities/${id}?view=${v}`} aria-current={view === v ? "page" : undefined} scroll={false} className="inline-flex min-h-11 shrink-0 items-center">
              <span className={cn("inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium", view === v ? "bg-accent-soft text-accent-ink ring-1 ring-accent/30" : "bg-surface-muted text-ink-muted hover:text-ink")}>{VIEW_LABEL[v]}</span>
            </Link>
          ))}
        </nav>

        {view === "forum" ? (
          topics.length ? (
            <ul aria-label="Topics" className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface/95 shadow-[var(--shadow-card)]">
              {topics.map((t) => (
                <li key={t.id} className="flex items-center">
                  <Link href={`/community/conversations/${t.id}`} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3.5 py-2.5 hover:bg-black/[0.02]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[16px] leading-snug text-ink">{t.title}</span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-ink-subtle">
                        <span className="text-accent-ink">{INTENT_LABEL[t.intent]}</span> · {t.author.name} · {t.postCount === 0 ? "1 post" : `${t.postCount + 1} posts`} · <RelativeTime iso={t.lastActivityAt} />
                        {t.closed ? " · Closed" : ""}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                  </Link>
                  {community.isHost ? <RemoveTopicButton communityId={id} topicId={t.id} topicTitle={t.title} /> : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              art={KIT.painted.lavenderSprig}
              title="No topics yet"
              body={community.isMember ? "Start the first one: a question, a thought, something to read together." : "Join to start the first topic."}
              action={community.isMember ? <StartTopicButton communityId={id} title={community.title} /> : undefined}
            />
          )
        ) : null}

        {view === "creations" ? (
          !community.isMember ? (
            <p className="flex items-center gap-2 rounded-2xl bg-surface-muted px-3.5 py-3 text-[13.5px] text-ink-muted">
              <Lock className="size-4 shrink-0" aria-hidden /> Members see the Creations shared here. Join to see them and share your own.
            </p>
          ) : shared.length ? (
            <ul aria-label="Creations shared here" className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface/95 shadow-[var(--shadow-card)]">
              {shared.map((x) => (
                <li key={x.itemId}>
                  <Link href={`/projects/${id}/shared/${x.itemId}`} className="flex min-h-14 items-center gap-3 px-3.5 py-2.5 hover:bg-black/[0.02]">
                    <span aria-hidden className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-accent-soft/70">
                      <FileText className="size-4 text-accent-ink" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[16px] leading-snug text-ink">{x.title}</span>
                      <span className="block truncate text-[12.5px] text-ink-subtle">
                        {x.detail ? `${x.detail} · ` : ""}
                        {x.mine ? "You" : x.sharedBy.name} · <RelativeTime iso={x.sharedAt} />
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState art={KIT.painted.flowerBranch} title="Nothing shared yet" body="Share a Creation with the community from its Creative Room." action={<Link href={`/projects/${id}?tab=work`} className="inline-flex min-h-11 items-center text-[14px] font-medium text-accent-ink hover:underline">Share a Creation</Link>} />
          )
        ) : null}

        {view === "huddles" ? (
          huddles.length ? (
            <ul aria-label="Live Huddles" className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface/95 shadow-[var(--shadow-card)]">
              {huddles.map((h) => (
                <li key={h.id}>
                  <Link href={`/huddles/${h.id}`} className="flex min-h-14 items-center gap-3 px-3.5 py-2.5 hover:bg-black/[0.02]">
                    <AudioLines className="size-5 shrink-0 text-live" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-ink">{h.topic ?? h.fromTopic?.title ?? "A Huddle"}</span>
                      <span className="block truncate text-[12.5px] text-ink-subtle">
                        Live now · {h.people === 1 ? "1 person" : `${h.people} people`}
                        {h.names.length ? ` · ${h.names.slice(0, 3).join(", ")}` : ""}
                        {h.fromTopic ? ` · from “${h.fromTopic.title}”` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-medium text-accent-ink">Join</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState art={KIT.iconChip.message} title="No Huddle right now" body="Huddles start from a topic: open one and start a Huddle to talk it through live." />
          )
        ) : null}

        {view === "members" ? (
          <div className="space-y-3">
            {(["host", "member"] as const).map((group) => {
              const list = members.filter((m) => (group === "host" ? m.access !== "member" : m.access === "member"));
              if (!list.length) return null;
              return (
                <section key={group} aria-labelledby={`members-${group}`} className="space-y-1.5">
                  <h2 id={`members-${group}`} className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                    {group === "host" ? "Owner & moderators" : `Members · ${list.length}`}
                  </h2>
                  <ul className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface/95">
                    {list.map((m) => (
                      <li key={m.id}>
                        {m.handle ? (
                          <Link href={`/creators/${m.handle}`} className="flex min-h-13 items-center gap-3 px-3.5 py-2 hover:bg-black/[0.02]">
                          <Avatar name={m.name} src={avatars[m.id] ?? null} size={36} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14.5px] font-medium text-ink">{m.name}</span>
                            <span className="block truncate text-[12.5px] text-ink-subtle">
                              {m.access === "member" ? (m.roleTitle ?? "Member") : ROLE[m.access]}
                              {m.joinedAt ? (
                                <>
                                  {" · joined "}
                                  <RelativeTime iso={m.joinedAt} />
                                </>
                              ) : null}
                            </span>
                          </span>
                          </Link>
                        ) : (
                          <div className="flex min-h-13 items-center gap-3 px-3.5 py-2">
                          <Avatar name={m.name} src={avatars[m.id] ?? null} size={36} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14.5px] font-medium text-ink">{m.name}</span>
                            <span className="block truncate text-[12.5px] text-ink-subtle">
                              {m.access === "member" ? (m.roleTitle ?? "Member") : ROLE[m.access]}
                              {m.joinedAt ? (
                                <>
                                  {" · joined "}
                                  <RelativeTime iso={m.joinedAt} />
                                </>
                              ) : null}
                            </span>
                          </span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            {community.isHost && community.crewId ? (
              <Link href={`/crews/${community.crewId}`} className="inline-flex min-h-11 items-center text-[13.5px] font-medium text-accent-ink hover:underline">
                Manage moderators and members
              </Link>
            ) : null}
          </div>
        ) : null}

        <footer className="flex flex-col items-center gap-1 pt-2">
          <KitArt art={KIT.painted.leafSprigSage} sizes="6rem" className="pointer-events-none h-14 w-auto opacity-60" />
          {community.isMember && !viewerIsOwner ? <JoinCommunityButton id={id} joined /> : null}
        </footer>
      </div>
    </>
  );
}

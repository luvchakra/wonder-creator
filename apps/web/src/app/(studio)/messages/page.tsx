import { listThreads, unreadMessages } from "@wonder/creator-projects";
import { EmptyState, KIT, KitArt, buttonClasses } from "@wonder/ui";
import Link from "next/link";
import { MessagesList, type MessageRow } from "@/components/messages/messages-list";
import { avatarUrls } from "@/lib/avatars";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Messages" };

/**
 * Messages (owner, 3 Oct 2026: "as clean and useful as WhatsApp"): one list of every conversation — direct ones and
 * the crew chats of the creator's Creative Rooms — newest first, searchable, with unread counts. A compact header; the
 * one action is to start a conversation (from a person's profile, so People is where that begins).
 */
export default async function MessagesPage() {
  const { db, creator } = await requireSession();
  const [threads, unread, crews] = await Promise.all([
    listThreads(db, creator.id),
    unreadMessages(db).catch(() => []),
    db.from("crew_members").select("crew_id, crews!inner(id, project_id, name, status, projects!inner(title, status))").eq("creator_id", creator.id).eq("status", "active").limit(100),
  ]);
  const avatars = await avatarUrls(db, threads.map((t) => t.other.id)).catch(() => ({}) as Record<string, string>);
  const crewUnread = new Map(unread.filter((u) => u.kind === "crew").map((u) => [u.id, u]));

  const rows: MessageRow[] = [
    ...threads.map((t) => ({
      id: t.id,
      href: `/messages/${t.id}`,
      title: t.other.name,
      kind: "direct" as const,
      avatarUrl: avatars[t.other.id] ?? null,
      preview: t.lastMessage?.body ?? null,
      previewMine: t.lastMessage?.mine ?? false,
      at: t.lastMessage?.at ?? null,
      unread: t.unread,
    })),
    ...(crews.data ?? [])
      .map((m) => m.crews as unknown as { id: string; project_id: string; name: string; status: string; projects: { title: string; status: string } } | null)
      .filter((c): c is NonNullable<typeof c> => !!c && c.projects.status !== "archived")
      .map((c) => {
        const u = crewUnread.get(c.id);
        return {
          id: `crew:${c.id}`,
          href: `/rooms/${c.project_id}?tab=chat`,
          title: c.projects.title || c.name,
          kind: "crew" as const,
          avatarUrl: null,
          preview: u ? `${u.latestAuthor ?? "Someone"} in the crew chat` : null,
          previewMine: false,
          at: u?.latestAt ?? null,
          unread: u?.unread ?? 0,
        };
      }),
  ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <header className="relative flex min-h-11 items-center justify-between gap-3">
        <h1 className="font-display text-[24px] leading-tight text-ink">Messages</h1>
        <KitArt art={KIT.mark.birds} sizes="3rem" className="pointer-events-none absolute left-[7.5rem] top-0 h-7 w-auto opacity-70" />
        <Link href="/people" className={buttonClasses({ size: "sm", variant: "soft" })}>
          New message
        </Link>
      </header>
      {rows.length ? (
        <MessagesList rows={rows} />
      ) : (
        <EmptyState art={KIT.mark.birds} title="No conversations yet" body="Open someone's profile and choose Message. Crew chats appear here once you're in a Creative Room's crew." action={<Link href="/people" className={buttonClasses({ size: "md" })}>Find people</Link>} />
      )}
    </div>
  );
}

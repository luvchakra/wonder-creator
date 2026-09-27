import { getCrew, myClosedInvitation } from "@wonder/creator-projects";
import { EmptyState, buttonClasses } from "@wonder/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { avatarUrls } from "@/lib/avatars";
import { requireSession } from "@/lib/session";
import { PaletteActions } from "@/components/creative-palette";
import { CrewView } from "./crew-view";

export const metadata = { title: "Crew" };

const CLOSED: Record<string, { title: string; body: string }> = {
  expired: { title: "This invitation has expired", body: "It can't be accepted any more. If you'd still like to join, ask the person who invited you to send a new invitation." },
  declined: { title: "You declined this invitation", body: "If you change your mind, the crew can invite you again." },
  cancelled: { title: "This invitation was cancelled", body: "The crew withdrew it. Nothing else changed." },
  left: { title: "You left this crew", body: "What you contributed stays credited to you." },
  removed: { title: "You're no longer in this crew", body: "What you contributed stays credited to you." },
};

export default async function CrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const data = await getCrew(db, creator.id, id).catch(() => null);
  if (!data) {
    // An invitation that's no longer open still explains itself (nothing about the crew's people or project).
    const closed = await myClosedInvitation(db, id).catch(() => null);
    const copy = closed ? CLOSED[closed.status] : null;
    if (!closed || !copy) notFound();
    return (
      <EmptyState
        title={copy.title}
        body={`${closed.crewName}${closed.roleTitle ? ` · ${closed.roleTitle}` : ""}. ${copy.body}`}
        action={
          <Link href="/projects" className={buttonClasses({ variant: "secondary" })}>
            Back to Creative Rooms
          </Link>
        }
      />
    );
  }
  const people = [...data.active, ...data.invited, ...data.former];
  const avatars = await avatarUrls(db, people.map((m) => m.creatorId));
  const inviter = data.me?.invitedBy ? (people.find((m) => m.creatorId === data.me!.invitedBy)?.name ?? null) : null;
  const withAvatar = <T extends { creatorId: string }>(m: T) => ({ ...m, avatarUrl: avatars[m.creatorId] ?? null });
  const inCrew = data.me?.status === "active";
  return (
    <>
      {inCrew ? (
        <PaletteActions
          title="This crew"
          actions={[
            { key: "room", label: "Creative Room", hint: data.project.title, href: `/projects/${data.project.id}`, icon: "room" },
            { key: "chat", label: "Chat & Huddle", href: `/projects/${data.project.id}?tab=chat`, icon: "users" },
            { key: "tasks", label: "Tasks", href: `/projects/${data.project.id}?tab=tasks` },
            { key: "find", label: "Find collaborators", href: `/discover?project=${data.project.id}`, icon: "people" },
          ]}
        />
      ) : null}
      <CrewView
      viewerId={creator.id}
      crew={data.crew}
      project={data.project}
      me={data.me ? { ...withAvatar(data.me), inviterName: inviter } : null}
      active={data.active.map(withAvatar)}
      invited={data.invited.map(withAvatar)}
      former={data.former.map(withAvatar)}
      activity={data.activity}
      messages={data.messages}
      />
    </>
  );
}

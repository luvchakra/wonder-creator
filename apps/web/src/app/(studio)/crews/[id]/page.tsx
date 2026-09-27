import { getCrew } from "@wonder/creator-projects";
import { notFound } from "next/navigation";
import { avatarUrls } from "@/lib/avatars";
import { requireSession } from "@/lib/session";
import { CrewView } from "./crew-view";

export const metadata = { title: "Crew" };

export default async function CrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const data = await getCrew(db, creator.id, id).catch(() => null);
  if (!data) notFound();
  const people = [...data.active, ...data.invited, ...data.former];
  const avatars = await avatarUrls(db, people.map((m) => m.creatorId));
  const inviter = data.me?.invitedBy ? people.find((m) => m.creatorId === data.me!.invitedBy)?.name ?? null : null;
  const withAvatar = <T extends { creatorId: string }>(m: T) => ({ ...m, avatarUrl: avatars[m.creatorId] ?? null });
  return (
    <CrewView
      viewerId={creator.id}
      crew={data.crew}
      project={data.project}
      me={data.me ? { ...withAvatar(data.me), inviterName: inviter } : null}
      active={data.active.map(withAvatar)}
      invited={data.invited.map(withAvatar)}
      former={data.former.map(withAvatar)}
      activity={data.activity}
    />
  );
}

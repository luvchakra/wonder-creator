import { liveCards, roomState } from "@wonder/creator-huddle";
import { selectMediaProvider } from "@wonder/creator-huddle/media";
import { notFound } from "next/navigation";
import { avatarUrls } from "@/lib/avatars";
import { requireSession } from "@/lib/session";
import { HuddleRoom } from "./room";

export const metadata = { title: "Huddle" };

export default async function HuddlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const [state, cards] = await Promise.all([roomState(db, id, creator.id), liveCards(db, { limit: 100 })]);
  const card = cards.find((c) => c.huddleId === id) ?? null;
  const ids = [...state.participants.map((p) => p.creator_id), ...state.requests.map((r) => r.requester_creator_id)];
  const avatars = await avatarUrls(db, ids);
  return <HuddleRoom huddleId={id} me={{ id: creator.id, name: creator.display_name }} initial={{ ...state, media: { configured: selectMediaProvider().configured } }} card={card} avatars={avatars} />;
}

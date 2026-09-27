import { liveCards, relatedItem, roomState } from "@wonder/creator-huddle";
import { selectMediaProvider } from "@wonder/creator-huddle/media";
import { notFound } from "next/navigation";
import { avatarUrls } from "@/lib/avatars";
import { requireSession } from "@/lib/session";
import { HuddleRoom } from "./room";
import { PaletteScope } from "@/components/creative-palette";

export const metadata = { title: "Huddle" };

export default async function HuddlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const [state, cards] = await Promise.all([roomState(db, id, creator.id), liveCards(db, { limit: 100 })]);
  const card = cards.find((c) => c.huddleId === id) ?? null;
  const ids = [...state.participants.map((p) => p.creator_id), ...state.requests.map((r) => r.requester_creator_id)];
  const [avatars, related, history] = await Promise.all([
    avatarUrls(db, ids),
    state.me?.status === "joined" ? relatedItem(db, id).catch(() => null) : Promise.resolve(null),
    db.from("huddle_history").select("huddle_id").eq("huddle_id", id).maybeSingle(),
  ]);
  return (
    <>
      <PaletteScope context={{ page: "huddle", ids: { artifactId: related?.kind === "artifact" && related.canOpen ? (related.id ?? undefined) : undefined, materialId: related?.kind === "material" && related.canOpen ? (related.id ?? undefined) : undefined } }} />
      <HuddleRoom
        huddleId={id}
        me={{ id: creator.id, name: creator.display_name }}
        initial={{ ...state, related, media: { configured: selectMediaProvider().configured } }}
        card={card}
        avatars={avatars}
        wasInIt={!!history.data}
      />
    </>
  );
}

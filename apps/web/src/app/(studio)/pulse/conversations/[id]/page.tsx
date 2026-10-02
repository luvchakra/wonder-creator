import { getConversation, topicCommunities } from "@wonder/creator-community";
import { entityDejaVus } from "@wonder/creator-moments";
import { notFound } from "next/navigation";
import { PaletteScope } from "@/components/creative-palette";
import { requireSession } from "@/lib/session";
import { ConversationView } from "./view";
import { readSummary, refreshSummaryLater } from "@/lib/conversation-summary";
import { flagOn } from "@/lib/features";

export const metadata = { title: "Conversation" };

/**
 * One Open Conversation (Phase 03 §5, §13–18). What it's about and each reply's attachment are shown only if the
 * viewer can open them — publicly visible is never the same as free to reuse, and a private attachment stays private.
 */
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  if (!flagOn("open_conversations_enabled")) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const detail = await getConversation(db, creator.id, id).catch(() => null);
  if (!detail) notFound();

  // Attachments: a title and a link only when the viewer's own access allows it.
  const refs = [
    ...(detail.conversation.sourceEntityType ? [{ type: detail.conversation.sourceEntityType, id: detail.conversation.sourceEntityId! }] : []),
    ...detail.replies.filter((r) => r.attachmentType).map((r) => ({ type: r.attachmentType!, id: r.attachmentEntityId! })),
  ];
  const [mats, arts] = await Promise.all([
    refs.some((r) => r.type === "material") ? db.from("creative_materials").select("id, title, type").in("id", refs.filter((r) => r.type === "material").map((r) => r.id)) : Promise.resolve({ data: [] }),
    refs.some((r) => r.type === "creation") ? db.from("artifacts").select("id, title").in("id", refs.filter((r) => r.type === "creation").map((r) => r.id)) : Promise.resolve({ data: [] }),
  ]);
  const visible: Record<string, { title: string; href: string }> = {};
  for (const m of mats.data ?? []) visible[m.id] = { title: m.title || "A Material", href: `/space/materials/${m.id}` };
  for (const a of arts.data ?? []) visible[a.id] = { title: a.title, href: `/artifacts/${a.id}` };
  const communities = flagOn("communities_enabled") ? await topicCommunities(db, id).catch(() => []) : [];
  const dejavus = await entityDejaVus(db, "conversation", id).catch(() => ({ momentId: null, dejavus: [] }));
  // "Conversation so far" (Phase 05 §9): what's stored now; a fresh one is written afterwards when it has fallen behind.
  const liveReplies = detail.replies.filter((r) => !r.deleted && !r.removed).length;
  const summary = await readSummary(db, id, liveReplies).catch(() => null);
  refreshSummaryLater(id, liveReplies, summary);

  return (
    <>
      <PaletteScope context={{ page: "explore" }} />
      <ConversationView detail={detail} viewerId={creator.id} attachments={visible} dejavus={dejavus} summary={summary} communities={communities} />
    </>
  );
}

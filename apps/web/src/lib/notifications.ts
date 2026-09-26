import "server-only";
import { TOOLS } from "@wonder/creator-brain";
import { liveCards } from "@wonder/creator-huddle";
import type { Db } from "@wonder/db";

export type NotificationKind = "proposal" | "join_request" | "huddle_invite" | "intake_failed";

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string | null;
  href: string;
  at: string;
}

const FAILED_INTAKE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Things waiting on the creator, derived from live state (nothing to mark read: an item disappears
 * once it's resolved). Every query runs through the caller's RLS-scoped client.
 */
export async function listNotifications(db: Db, creatorId: string): Promise<Notification[]> {
  const since = new Date(Date.now() - FAILED_INTAKE_WINDOW_MS).toISOString();
  const [proposals, requests, invites, cards, failed] = await Promise.all([
    db.from("ai_proposals").select("id, action, understood, conversation_id, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(10),
    db
      .from("huddle_join_requests")
      .select("id, huddle_id, created_at, creators!huddle_join_requests_requester_creator_id_fkey(display_name)")
      .eq("status", "pending")
      .neq("requester_creator_id", creatorId)
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("huddle_invitations")
      .select("huddle_id, created_at, creators!huddle_invitations_invited_by_creator_id_fkey(display_name)")
      .eq("invitee_creator_id", creatorId)
      .order("created_at", { ascending: false })
      .limit(10),
    liveCards(db, { limit: 100 }).catch(() => []),
    db.from("intake_items").select("id, input_kind, error_message, updated_at").eq("state", "failed").gte("updated_at", since).order("updated_at", { ascending: false }).limit(5),
  ]);

  const out: Notification[] = [];
  for (const p of proposals.data ?? []) {
    const label = TOOLS[p.action as keyof typeof TOOLS]?.label;
    out.push({
      id: `proposal:${p.id}`,
      kind: "proposal",
      title: label ? `Waiting for your OK: ${label.toLowerCase()}` : "CreatorBrain is waiting for your OK",
      detail: p.understood.slice(0, 140),
      href: p.conversation_id ? `/create?c=${p.conversation_id}` : "/create",
      at: p.created_at,
    });
  }
  for (const r of requests.data ?? []) {
    const who = (r.creators as { display_name: string } | null)?.display_name || "A creator";
    out.push({ id: `join:${r.id}`, kind: "join_request", title: `${who} asked to join your Huddle`, detail: null, href: `/huddles/${r.huddle_id}`, at: r.created_at });
  }
  // Invitations only matter while the Huddle is live and the creator isn't already in it.
  const live = new Map(cards.map((c) => [c.huddleId, c]));
  for (const i of invites.data ?? []) {
    const card = live.get(i.huddle_id);
    if (!card || card.viewerState === "joined") continue;
    const who = (i.creators as { display_name: string } | null)?.display_name || "A creator";
    out.push({ id: `invite:${i.huddle_id}`, kind: "huddle_invite", title: `${who} invited you to a Huddle`, detail: card.topic, href: `/huddles/${i.huddle_id}`, at: i.created_at });
  }
  for (const f of failed.data ?? []) {
    out.push({ id: `intake:${f.id}`, kind: "intake_failed", title: `Something you sent (${f.input_kind}) couldn't be processed`, detail: f.error_message, href: "/send", at: f.updated_at });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

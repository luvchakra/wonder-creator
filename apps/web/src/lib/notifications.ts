import "server-only";
import { TOOLS } from "@wonder/creator-brain";
import { liveCards } from "@wonder/creator-huddle";
import { inviteThreadsWaiting, myCrewInvites, unreadMessages } from "@wonder/creator-projects";
import type { Db } from "@wonder/db";

export type NotificationKind = "proposal" | "join_request" | "huddle_invite" | "intake_failed" | "run_active" | "run_unfinished" | "license_request" | "license_response" | "shared_with_you" | "crew_invite" | "crew_question" | "proposal_review" | "proposal_decided" | "collaborator_added" | "rights_claim" | "message" | "testimonial" | "testimonial_shown";

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string | null;
  href: string;
  at: string;
  /** The person behind it, when there is one (Home shows their avatar). */
  actor?: { id: string | null; name: string };
}

const FAILED_INTAKE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RUN_WINDOW_MS = 24 * 60 * 60 * 1000;
const RUN_STALE_MS = 10 * 60 * 1000;

/**
 * Things waiting on the creator, derived from live state (nothing to mark read: an item disappears
 * once it's resolved). Every query runs through the caller's RLS-scoped client.
 */
export async function listNotifications(db: Db, creatorId: string): Promise<Notification[]> {
  const since = new Date(Date.now() - FAILED_INTAKE_WINDOW_MS).toISOString();
  // Testimonials (docs/testimonials.md): ones waiting for your decision, and yours that were shown this week.
  const testimonials = db
    .from("creator_testimonials")
    .select("id, from_creator_id, to_creator_id, status, created_at, decided_at, creators!creator_testimonials_from_creator_id_fkey(display_name), receiver:creators!creator_testimonials_to_creator_id_fkey(display_name, handle)")
    .or(`and(to_creator_id.eq.${creatorId},status.eq.pending),and(from_creator_id.eq.${creatorId},status.eq.shown,decided_at.gte.${since})`)
    .order("created_at", { ascending: false })
    .limit(10);
  const runSince = new Date(Date.now() - RUN_WINDOW_MS).toISOString();
  const [proposals, requests, invites, cards, failed, runs, licenseAsks, licenseAnswers, shared, crewInvites, crewThreads, toReview, decided, addedAs, claims, unread] = await Promise.all([
    db.from("ai_proposals").select("id, action, understood, conversation_id, created_at").eq("status", "pending").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(10),
    db
      .from("huddle_join_requests")
      .select("id, huddle_id, created_at, requester_creator_id, creators!huddle_join_requests_requester_creator_id_fkey(display_name)")
      .eq("status", "pending")
      .neq("requester_creator_id", creatorId)
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("huddle_invitations")
      .select("huddle_id, created_at, invited_by_creator_id, creators!huddle_invitations_invited_by_creator_id_fkey(display_name)")
      .eq("invitee_creator_id", creatorId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10),
    liveCards(db, { limit: 100 }).catch(() => []),
    db.from("intake_items").select("id, input_kind, error_message, updated_at").eq("state", "failed").gte("updated_at", since).order("updated_at", { ascending: false }).limit(5),
    // Creation runs still going, or ones that didn't finish and haven't been retried.
    db
      .from("ai_runs")
      .select("id, status, started_at, completed_at, artifact_id, retries:ai_runs!ai_runs_retry_of_fkey(id)")
      .eq("intent", "create")
      .in("status", ["running", "failed", "cancelled"])
      .gte("started_at", runSince)
      .order("started_at", { ascending: false })
      .limit(5),
    // License requests waiting on me, and answers to mine from the last week.
    db
      .from("license_requests")
      .select("id, artifact_id, created_at, requester_creator_id, artifacts(title), creators!license_requests_requester_creator_id_fkey(display_name)")
      .eq("owner_creator_id", creatorId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("license_requests")
      .select("id, artifact_id, status, responded_at, artifacts(title)")
      .eq("requester_creator_id", creatorId)
      .in("status", ["approved", "declined", "countered"])
      .gte("responded_at", since)
      .order("responded_at", { ascending: false })
      .limit(10),
    db.rpc("shared_with_me"),
    myCrewInvites(db, creatorId).catch(() => []),
    inviteThreadsWaiting(db, creatorId).catch(() => []),
    // Collaboration: proposals waiting on me, decisions on mine, and pieces I was added to.
    db
      .from("artifact_change_proposals")
      .select("id, artifact_id, summary, created_at, creator_id, artifacts!inner(title, creator_id), creators!artifact_change_proposals_creator_id_fkey(display_name)")
      .eq("status", "open")
      .eq("artifacts.creator_id", creatorId)
      .order("created_at", { ascending: false })
      .limit(10),
    db.from("artifact_change_proposals").select("id, artifact_id, status, decided_at, artifacts(title)").eq("creator_id", creatorId).in("status", ["accepted", "declined"]).gte("decided_at", since).order("decided_at", { ascending: false }).limit(10),
    db.from("artifact_contributors").select("artifact_id, role, created_at, artifacts(title)").eq("contributor_creator_id", creatorId).gte("created_at", since).order("created_at", { ascending: false }).limit(10),
    // Ownership claims on my pieces that I haven't responded to.
    db
      .from("ownership_assertions")
      .select("id, project_id, created_at, creator_id, artifacts!inner(title, creator_id), creators!ownership_assertions_creator_id_fkey(display_name)")
      .eq("status", "asserted")
      .eq("artifacts.creator_id", creatorId)
      .order("created_at", { ascending: false })
      .limit(10),
    unreadMessages(db).catch(() => []),
  ]);

  const out: Notification[] = [];
  for (const p of proposals.data ?? []) {
    const label = TOOLS[p.action as keyof typeof TOOLS]?.label;
    out.push({
      id: `proposal:${p.id}`,
      kind: "proposal",
      title: label ? `Waiting for your OK: ${label.toLowerCase()}` : "CreativeMind is waiting for your OK",
      detail: p.understood.slice(0, 140),
      href: `/approvals/${p.id}`,
      at: p.created_at,
    });
  }
  for (const r of requests.data ?? []) {
    const who = (r.creators as { display_name: string } | null)?.display_name || "A creator";
    out.push({ id: `join:${r.id}`, kind: "join_request", title: `${who} asked to join your Huddle`, detail: null, href: `/huddles/${r.huddle_id}`, at: r.created_at, actor: { id: r.requester_creator_id, name: who } });
  }
  // Invitations only matter while the Huddle is live and the creator isn't already in it.
  const live = new Map(cards.map((c) => [c.huddleId, c]));
  for (const i of invites.data ?? []) {
    const card = live.get(i.huddle_id);
    if (!card || card.viewerState === "joined") continue;
    const who = (i.creators as { display_name: string } | null)?.display_name || "A creator";
    out.push({ id: `invite:${i.huddle_id}`, kind: "huddle_invite", title: `${who} invited you to a Huddle`, detail: card.topic, href: `/huddles/${i.huddle_id}`, at: i.created_at, actor: { id: i.invited_by_creator_id, name: who } });
  }
  for (const f of failed.data ?? []) {
    out.push({ id: `intake:${f.id}`, kind: "intake_failed", title: `Something you sent (${f.input_kind}) couldn't be processed`, detail: f.error_message, href: "/send", at: f.updated_at });
  }
  for (const r of runs.data ?? []) {
    if (r.artifact_id || ((r.retries as unknown as Array<{ id: string }>) ?? []).length) continue;
    const stale = r.status === "running" && Date.now() - new Date(r.started_at).getTime() > RUN_STALE_MS;
    if (r.status === "running" && !stale) {
      out.push({ id: `run:${r.id}`, kind: "run_active", title: "CreativeMind is working on a draft", detail: "See its progress", href: `/create/runs/${r.id}`, at: r.started_at });
    } else if (r.status !== "cancelled") {
      out.push({ id: `run:${r.id}`, kind: "run_unfinished", title: "A draft didn't finish", detail: "You can try again — nothing was lost.", href: `/create/runs/${r.id}`, at: r.completed_at ?? r.started_at });
    }
  }
  for (const r of licenseAsks.data ?? []) {
    const who = (r.creators as { display_name: string } | null)?.display_name || "A creator";
    const title = (r.artifacts as { title: string } | null)?.title ?? "your Creation";
    out.push({ id: `license-ask:${r.id}`, kind: "license_request", title: `${who} asked to license “${title}”`, detail: "Review the proposed use and terms", href: `/artifacts/${r.artifact_id}?tab=rights`, at: r.created_at, actor: { id: r.requester_creator_id, name: who } });
  }
  for (const r of licenseAnswers.data ?? []) {
    const title = (r.artifacts as { title: string } | null)?.title ?? "a Creation";
    const verb = r.status === "approved" ? "approved" : r.status === "declined" ? "declined" : "sent a counter-offer for";
    out.push({ id: `license-answer:${r.id}`, kind: "license_response", title: `The creator ${verb} your license request for “${title}”`, detail: null, href: `/artifacts/${r.artifact_id}`, at: r.responded_at ?? new Date().toISOString() });
  }
  // Direct shares from the last week (they stay under Shared with you for as long as they're live).
  for (const r of (shared.data ?? []).filter((x) => x.shared_at >= since).slice(0, 10)) {
    out.push({ id: `share:${r.share_id}`, kind: "shared_with_you", title: `${r.creator_name} shared “${r.title}” with you`, detail: null, href: `/shared/${r.share_id}`, at: r.shared_at, actor: { id: null, name: r.creator_name } });
  }
  for (const p of toReview.data ?? []) {
    const who = (p.creators as { display_name: string } | null)?.display_name || "A collaborator";
    out.push({ id: `proposal-review:${p.id}`, kind: "proposal_review", title: `${who} proposed a change to “${(p.artifacts as { title: string } | null)?.title ?? "your Creation"}”`, detail: p.summary, href: `/artifacts/${p.artifact_id}/collaborate`, at: p.created_at, actor: { id: p.creator_id, name: who } });
  }
  for (const p of decided.data ?? []) {
    out.push({ id: `proposal-decided:${p.id}`, kind: "proposal_decided", title: `Your change to “${(p.artifacts as { title: string } | null)?.title ?? "a Creation"}” was ${p.status}`, detail: null, href: `/artifacts/${p.artifact_id}/collaborate`, at: p.decided_at ?? new Date().toISOString() });
  }
  for (const c of addedAs.data ?? []) {
    out.push({ id: `collab:${c.artifact_id}`, kind: "collaborator_added", title: `You were added as ${c.role} on “${(c.artifacts as { title: string } | null)?.title ?? "a Creation"}”`, detail: null, href: `/artifacts/${c.artifact_id}/collaborate`, at: c.created_at });
  }
  for (const u of unread) {
    const n = `${u.unread} new ${u.unread === 1 ? "message" : "messages"}`;
    out.push(
      u.kind === "crew"
        ? { id: `crew-chat:${u.id}`, kind: "message", title: `${n} in ${u.title}`, detail: u.latestAuthor ? `Latest from ${u.latestAuthor}` : null, href: `/projects/${u.projectId}?tab=chat`, at: u.latestAt }
        : { id: `dm:${u.id}`, kind: "message", title: `${u.title} sent you ${u.unread === 1 ? "a message" : n}`, detail: null, href: `/messages/${u.id}`, at: u.latestAt, actor: { id: null, name: u.title } },
    );
  }
  for (const c of claims.data ?? []) {
    const who = (c.creators as { display_name: string } | null)?.display_name || "A collaborator";
    out.push({ id: `rights-claim:${c.id}`, kind: "rights_claim", title: `${who} made an ownership claim on “${(c.artifacts as { title: string } | null)?.title ?? "your Creation"}”`, detail: "Acknowledge or dispute it", href: `/projects/${c.project_id}?tab=rights`, at: c.created_at, actor: { id: c.creator_id, name: who } });
  }
  for (const t of (await testimonials).data ?? []) {
    const writer = (t.creators as { display_name: string } | null)?.display_name || "Someone";
    const receiver = t.receiver as { display_name: string; handle: string | null } | null;
    if (t.status === "pending" && t.to_creator_id === creatorId) {
      out.push({ id: `testimonial:${t.id}`, kind: "testimonial", title: `${writer} wrote you a testimonial`, detail: "Read it, then show it or keep it private", href: "/profile", at: t.created_at, actor: { id: t.from_creator_id, name: writer } });
    } else if (receiver?.handle) {
      out.push({ id: `testimonial-shown:${t.id}`, kind: "testimonial_shown", title: `${receiver.display_name} is showing your testimonial`, detail: null, href: `/creators/${receiver.handle}`, at: t.decided_at ?? t.created_at });
    }
  }
  for (const c of crewInvites) {
    out.push({ id: `crew:${c.crewId}`, kind: "crew_invite", title: `${c.invitedBy} invited you to join ${c.crewName}`, detail: c.roleTitle ? `As ${c.roleTitle} · ${c.projectTitle}` : c.projectTitle, href: `/crews/${c.crewId}`, at: c.invitedAt, actor: { id: null, name: c.invitedBy } });
  }
  for (const t of crewThreads) {
    out.push({
      id: `crew-q:${t.crewId}:${t.inviteeId}`,
      kind: "crew_question",
      title: t.kind === "question" ? `${t.author} asked about joining ${t.crewName}` : `${t.author} answered your question about ${t.crewName}`,
      detail: null,
      href: `/crews/${t.crewId}`,
      at: t.at,
      actor: { id: null, name: t.author },
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

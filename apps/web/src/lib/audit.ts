import "server-only";
import { fromDbError } from "@wonder/core";
import { describeRightsEvent } from "@wonder/creator-studio";
import type { Db } from "@wonder/db";
import { z } from "zod";

/**
 * The creator's security & audit history (P0.1-17), in plain words. Merges their audit log, their rights
 * history and their Huddle activity; everything is read through their own RLS-scoped client. Entries carry
 * titles and settings, never creative content.
 */
export const AUDIT_CATEGORIES = [
  { key: "security", label: "Sign-in & security" },
  { key: "sharing", label: "Sharing & access" },
  { key: "publishing", label: "Publishing" },
  { key: "rights", label: "Rights & licensing" },
  { key: "approvals", label: "Approvals" },
  { key: "autonomy", label: "Autonomy" },
  { key: "exports", label: "Exports & deletion" },
  { key: "collaboration", label: "Huddles & collaboration" },
  { key: "profile", label: "Profile & privacy" },
  { key: "providers", label: "AI providers" },
] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]["key"];

export interface AuditEntry {
  id: string;
  at: string;
  category: AuditCategory;
  title: string;
  outcome: "done" | "failed" | "declined";
  actor: string;
  entity: { label: string; href: string | null } | null;
  details: Array<{ label: string; value: string }>;
}

export const auditQuerySchema = z.object({
  category: z.enum(AUDIT_CATEGORIES.map((c) => c.key) as [AuditCategory, ...AuditCategory[]]).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  before: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

type Row = { id: string; at: string; action: string; objectType: string; objectId: string | null; meta: Record<string, unknown> };
type Described = Omit<AuditEntry, "id" | "at" | "entity" | "details"> & { details?: AuditEntry["details"]; entity?: { kind: "artifact" | "material" | "approval" | "huddle"; id: string } | null };

const yesNo = (v: unknown) => (v ? "Yes" : "No");
const words = (s: unknown) => String(s ?? "").replace(/_/g, " ");

function describeAudit(r: Row): Described | null {
  const m = r.meta;
  const you = "You";
  switch (r.action) {
    case "auth.signed_in":
    case "auth.signed_up":
      return { category: "security", title: r.action === "auth.signed_in" ? "Signed in" : "Created your account", outcome: "done", actor: you, details: [{ label: "Device", value: String(m.device ?? "Unknown") }, ...(m.network ? [{ label: "Network", value: String(m.network) }] : [])] };
    case "auth.signed_out":
      return { category: "security", title: "Signed out", outcome: "done", actor: you, details: m.device ? [{ label: "Device", value: String(m.device) }] : [] };
    case "auth.step_up":
    case "auth.step_up_failed":
      return { category: "security", title: r.action === "auth.step_up" ? "Confirmed your password" : "A password confirmation didn't match", outcome: r.action === "auth.step_up" ? "done" : "failed", actor: you, details: m.for ? [{ label: "To", value: String(m.for) }] : [] };
    case "creator.block":
    case "creator.unblock":
      return { category: "security", title: r.action === "creator.block" ? "Blocked a creator" : "Unblocked a creator", outcome: "done", actor: you };
    case "share.created":
      return {
        category: "sharing",
        title: m.kind === "link" ? "Made a private link" : "Shared a piece with a creator",
        outcome: "done",
        actor: you,
        entity: r.objectId ? { kind: "artifact", id: r.objectId } : null,
        details: [
          { label: "Ends", value: m.expires_at ? new Date(String(m.expires_at)).toUTCString() : "No end date" },
          { label: "Downloads allowed", value: yesNo(m.allow_download) },
          ...(m.kind === "link" ? [{ label: "Embedding allowed", value: yesNo(m.allow_embed) }] : []),
        ],
      };
    case "share.revoked":
      return { category: "sharing", title: m.kind === "link" ? "Turned off a private link" : "Stopped sharing with a creator", outcome: "done", actor: you, entity: r.objectId ? { kind: "artifact", id: r.objectId } : null };
    case "artifact.visibility":
      return { category: "sharing", title: "Changed who can see a piece", outcome: "done", actor: you, entity: r.objectId ? { kind: "artifact", id: r.objectId } : null, details: [{ label: "Now", value: m.privacy === "public" ? "Public" : "Private" }] };
    case "material.downloaded":
      return { category: "exports", title: "Downloaded an original file", outcome: "done", actor: you, entity: r.objectId ? { kind: "material", id: r.objectId } : null };
    case "artifact.exported":
      return { category: "exports", title: "Downloaded a piece", outcome: "done", actor: you, entity: r.objectId ? { kind: "artifact", id: r.objectId } : null, details: [{ label: "Format", value: String(m.format ?? "") }, { label: "Version", value: String(m.version ?? "") }] };
    case "account.exported":
      return { category: "exports", title: "Exported your account data", outcome: "done", actor: you };
    case "audit.exported":
      return { category: "exports", title: "Downloaded your activity history", outcome: "done", actor: you };
    case "material.deleted":
      return { category: "exports", title: "Deleted material", outcome: "done", actor: you };
    case "artifact.delete":
      return { category: "exports", title: "Deleted a piece", outcome: "done", actor: you };
    case "artifact.restore":
      return { category: "profile", title: "Restored an earlier version", outcome: "done", actor: you, entity: r.objectId ? { kind: "artifact", id: r.objectId } : null, details: [{ label: "From version", value: String(m.from ?? "") }] };
    case "publication.approved":
      return { category: "publishing", title: m.scheduled_for ? "Approved a scheduled publication" : "Approved a publication", outcome: "done", actor: you, entity: m.artifact_id ? { kind: "artifact", id: String(m.artifact_id) } : null, details: [{ label: "Destination", value: m.destination === "profile" ? "Your profile" : "Webhook" }] };
    case "publication.published":
      return { category: "publishing", title: "Published", outcome: "done", actor: "Wonder Creator, on your approval", entity: m.artifact_id ? { kind: "artifact", id: String(m.artifact_id) } : null, details: [{ label: "Destination", value: m.destination === "profile" ? "Your profile" : "Webhook" }, ...(m.external_url ? [{ label: "Link", value: String(m.external_url) }] : [])] };
    case "publication.failed":
      return { category: "publishing", title: "A publication didn't go through", outcome: "failed", actor: "Wonder Creator, on your approval", entity: m.artifact_id ? { kind: "artifact", id: String(m.artifact_id) } : null, details: [{ label: "Attempts", value: String(m.attempts ?? 1) }] };
    case "publication.cancelled":
      return { category: "publishing", title: "Cancelled a publication", outcome: "done", actor: you, entity: m.artifact_id ? { kind: "artifact", id: String(m.artifact_id) } : null };
    case "autonomy.update":
      return { category: "autonomy", title: "Changed Creator Autonomy", outcome: "done", actor: you, details: [{ label: "Area", value: words(m.domain) }, { label: "Level", value: words(m.level) }] };
    case "autonomy.reset":
      return { category: "autonomy", title: "Reset Creator Autonomy to defaults", outcome: "done", actor: you };
    case "ai_key.connected":
    case "ai_key.rotated":
    case "ai_key.removed":
    case "ai_key.validated":
    case "ai_key.preferences": {
      const name = m.provider === "gemini" ? "Gemini" : m.provider === "anthropic" ? "Anthropic" : "AI";
      const titles: Record<string, string> = {
        "ai_key.connected": `Connected your ${name} key`,
        "ai_key.rotated": `Replaced your ${name} key`,
        "ai_key.removed": `Removed your ${name} key`,
        "ai_key.validated": m.status === "invalid" ? `Your ${name} key was not accepted` : `Checked your ${name} key`,
        "ai_key.preferences": `Changed how CreatorBrain uses your ${name} key`,
      };
      return {
        category: "providers",
        title: titles[r.action],
        outcome: r.action === "ai_key.validated" && m.status === "invalid" ? "failed" : "done",
        actor: you,
        details: [
          ...(m.status ? [{ label: "Status", value: words(m.status) }] : []),
          ...(r.action === "ai_key.preferences" ? [{ label: "Model", value: String(m.default_model ?? "Recommended") }, { label: "Used for CreatorBrain", value: yesNo(m.use_for_brain) }] : []),
        ],
      };
    }
    case "scrapbook.posted":
      return { category: "sharing", title: "Shared to your Scrapbook", outcome: "done", actor: you, details: [{ label: "Who can see it", value: m.visibility === "private" ? "Only you" : "People who can see your profile" }, { label: "Replies", value: words(m.replies) }] };
    case "scrapbook.settings":
      return { category: "sharing", title: "Changed who can see or reply to a Scrapbook post", outcome: "done", actor: you, details: [{ label: "Who can see it", value: m.visibility === "private" ? "Only you" : "People who can see your profile" }, { label: "Replies", value: words(m.replies) }] };
    case "scrapbook.deleted":
      return { category: "exports", title: "Deleted a Scrapbook post", outcome: "done", actor: you };
    case "profile.update":
      return { category: "profile", title: "Updated your profile", outcome: "done", actor: you, details: m.visibility ? [{ label: "Profile visibility", value: words(m.visibility) }] : [] };
  }
  if (r.action.startsWith("approval.")) {
    const status = r.action.slice("approval.".length);
    const label: Record<string, [string, AuditEntry["outcome"], string]> = {
      approved: ["Approved a CreatorBrain request", "done", "You"],
      executed: ["CreatorBrain carried out an approved request", "done", "CreatorBrain, on your approval"],
      failed: ["An approved request didn't finish", "failed", "CreatorBrain, on your approval"],
      rejected: ["Declined a CreatorBrain request", "declined", "You"],
      cancelled: ["A CreatorBrain request was replaced or cancelled", "declined", "You"],
      expired: ["A CreatorBrain request expired", "declined", "Wonder Creator"],
    };
    const [title, outcome, actor] = label[status] ?? ["Approval updated", "done", "You"];
    return { category: "approvals", title, outcome, actor, entity: r.objectId ? { kind: "approval", id: r.objectId } : null, details: [{ label: "Action", value: words(m.action) }, { label: "Area", value: words(m.domain) }] };
  }
  // Rights table changes are shown from the semantic rights history instead.
  if (r.action.startsWith("rights.")) return null;
  return { category: "profile", title: "Account activity", outcome: "done", actor: you, details: [{ label: "Event", value: r.action }] };
}

const HUDDLE_TITLES: Record<string, string> = {
  HuddleStarted: "Started a Huddle",
  HuddleParticipantJoined: "Joined a Huddle",
  HuddleParticipantLeft: "Left a Huddle",
  HuddleJoinRequested: "Asked to join a Huddle",
  HuddleJoinApproved: "Approved a join request",
  HuddleJoinDeclined: "Declined a join request",
  HuddleParticipantRemoved: "Removed someone from a Huddle",
  HuddleCreatorInvited: "Invited a creator to a Huddle",
  HuddleContentPreserved: "Kept something from a Huddle",
  HuddleDissolved: "A Huddle ended",
};

function between<T extends { gte(column: string, value: string): T; lt(column: string, value: string): T }>(q: T, col: string, a: AuditQuery): T {
  let x = q;
  if (a.from) x = x.gte(col, `${a.from}T00:00:00Z`);
  if (a.to) x = x.lt(col, new Date(new Date(`${a.to}T00:00:00Z`).getTime() + 86400_000).toISOString());
  if (a.before) x = x.lt(col, a.before);
  return x;
}

export async function listAudit(db: Db, raw: unknown): Promise<{ entries: AuditEntry[]; nextBefore: string | null }> {
  const a = auditQuerySchema.parse(raw);
  const want = (c: AuditCategory) => !a.category || a.category === c;
  const n = a.limit;

  const auditQ = want("security") || want("sharing") || want("publishing") || want("approvals") || want("autonomy") || want("exports") || want("profile")
    ? between(db.from("audit_logs").select("id, created_at, action, object_type, object_id, metadata").not("action", "like", "rights.%"), "created_at", a).order("created_at", { ascending: false }).limit(n)
    : null;
  const rightsQ = want("rights")
    ? between(db.from("rights_events").select("id, created_at, event, details, rights_records(artifact_id)"), "created_at", a).order("created_at", { ascending: false }).limit(n)
    : null;
  const huddleQ = want("collaboration")
    ? between(db.from("domain_events").select("id, occurred_at, event_type, aggregate_id").in("event_type", Object.keys(HUDDLE_TITLES)), "occurred_at", a).order("occurred_at", { ascending: false }).limit(n)
    : null;
  const [audit, rights, huddles] = await Promise.all([auditQ, rightsQ, huddleQ]);
  for (const r of [audit, rights, huddles]) if (r?.error) throw fromDbError(r.error);

  type Pending = Omit<AuditEntry, "entity"> & { ref: Described["entity"] };
  const out: Pending[] = [];
  for (const r of (audit?.data ?? []) as Array<{ id: number; created_at: string; action: string; object_type: string; object_id: string | null; metadata: Record<string, unknown> }>) {
    const d = describeAudit({ id: String(r.id), at: r.created_at, action: r.action, objectType: r.object_type, objectId: r.object_id, meta: r.metadata ?? {} });
    if (!d || !want(d.category)) continue;
    out.push({ id: `a${r.id}`, at: r.created_at, category: d.category, title: d.title, outcome: d.outcome, actor: d.actor, details: d.details ?? [], ref: d.entity ?? null });
  }
  for (const r of (rights?.data ?? []) as Array<{ id: string; created_at: string; event: string; details: Record<string, unknown>; rights_records: { artifact_id: string } | null }>) {
    const d = describeRightsEvent(r.event, r.details ?? {});
    const requester = r.event.startsWith("license.request") && r.details?.requester ? String(r.details.requester) : null;
    out.push({
      id: `r${r.id}`,
      at: r.created_at,
      category: "rights",
      title: d.title,
      outcome: r.event.endsWith("declined") || r.event.endsWith("withdrawn") || r.event.endsWith("revoked") ? "declined" : "done",
      actor: requester && r.event === "license.requested" ? requester : "You",
      details: [],
      ref: r.rights_records?.artifact_id ? { kind: "artifact", id: r.rights_records.artifact_id } : null,
    });
  }
  for (const r of (huddles?.data ?? []) as Array<{ id: string; occurred_at: string; event_type: string; aggregate_id: string | null }>) {
    out.push({ id: `h${r.id}`, at: r.occurred_at, category: "collaboration", title: HUDDLE_TITLES[r.event_type] ?? "Huddle activity", outcome: "done", actor: "You", details: [], ref: null });
  }
  out.sort((x, y) => y.at.localeCompare(x.at));
  const page = out.slice(0, n);

  // Titles for related pieces and material (never their content).
  const ids = (kind: string) => [...new Set(page.filter((p) => p.ref?.kind === kind).map((p) => p.ref!.id))];
  const [arts, mats] = await Promise.all([
    ids("artifact").length ? db.from("artifacts").select("id, title").in("id", ids("artifact")) : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
    ids("material").length ? db.from("creative_materials").select("id, title").in("id", ids("material")) : Promise.resolve({ data: [] as Array<{ id: string; title: string | null }> }),
  ]);
  const artTitle = new Map((arts.data ?? []).map((x) => [x.id, x.title]));
  const matTitle = new Map((mats.data ?? []).map((x) => [x.id, x.title]));
  const entries = page.map(({ ref, ...e }) => {
    let entity: AuditEntry["entity"] = null;
    if (ref?.kind === "artifact") entity = artTitle.has(ref.id) ? { label: `Piece: ${artTitle.get(ref.id)}`, href: `/artifacts/${ref.id}` } : { label: "A piece that's no longer here", href: null };
    if (ref?.kind === "material") entity = matTitle.has(ref.id) ? { label: `Material: ${matTitle.get(ref.id) || "Untitled"}`, href: `/space/materials/${ref.id}` } : { label: "Material that's no longer here", href: null };
    if (ref?.kind === "approval") entity = { label: "The request", href: `/approvals/${ref.id}` };
    return { ...e, entity };
  });
  return { entries, nextBefore: out.length > n || page.length === n ? (page.at(-1)?.at ?? null) : null };
}

function csvCell(v: string): string {
  const s = /^[=+\-@]/.test(v) ? `'${v}` : v; // no spreadsheet formulas
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function auditCsv(entries: AuditEntry[]): string {
  const head = ["Time (UTC)", "Category", "Event", "Outcome", "By", "Related", "Details"];
  const label = new Map<string, string>(AUDIT_CATEGORIES.map((c) => [c.key, c.label]));
  const rows = entries.map((e) => [e.at, label.get(e.category) ?? e.category, e.title, e.outcome, e.actor, e.entity?.label ?? "", e.details.map((d) => `${d.label}: ${d.value}`).join("; ")]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

import { DomainError, fromDbError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { filterOf, NOTE_MATERIAL_TYPES } from "./shared";

/**
 * "Your world is connecting" (Phase 05 §5, docs/creativemind-orchestration.md). CreativeMind looks across the creator's
 * own Moments for relationships worth one quiet card on Home, and keeps the evidence so "Why am I seeing this?" has a
 * plain answer. Evidence is always something recorded — a shared tag, the same day, closeness in what two Materials
 * describe (from the search index, never shown), an unfinished Creation and a fresh note that name the same thing.
 * Nothing is attached, moved or renamed; a dismissed connection never comes back; confidence is internal only.
 */

export type ConnectionType = "shared_theme" | "shared_person" | "shared_place" | "same_memory" | "creative_opportunity" | "unused_pairing";

export interface MomentConnection {
  id: string;
  momentIds: string[];
  connectionType: ConnectionType;
  shortExplanation: string;
  evidence: string[];
  status: "new" | "opened" | "dismissed" | "used";
  createdAt: string;
  expiresAt: string | null;
}

export interface ConnectionCandidate {
  momentIds: string[];
  connectionType: ConnectionType;
  shortExplanation: string;
  evidence: string[];
  confidence: number;
}

/** One connection per set of Moments and kind, whatever order they were found in. */
export const connectionSignature = (type: ConnectionType, momentIds: string[]) => `${type}:${[...new Set(momentIds)].sort().join(",")}`;

// Words that describe the file rather than the life in it (§6: "prefer human concepts over metadata").
const WEAK = new Set([
  ..."photo photos image images picture pictures video videos audio voice note notes text file document pdf screenshot content media untitled draft new old misc other stuff things"
    .split(" "),
  ..."monday tuesday wednesday thursday friday saturday sunday today yesterday morning evening night".split(" "),
  ..."red orange yellow green blue purple pink brown black white grey gray colour color".split(" "),
  ..."january february march april may june july august september october november december".split(" "),
]);

/** A tag or name worth building on: a human concept, not metadata (Photo, Blue, Tuesday, Content…). */
export function isMeaningfulName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (n.length < 3 || n.length > 40 || /^\d+$/.test(n) || /^(img|dsc|vid|pxl)[_-]?\d/i.test(n)) return false;
  const words = n.split(/[\s_-]+/).filter(Boolean);
  return words.some((w) => !WEAK.has(w.replace(/s$/, "")) && !WEAK.has(w));
}

const KIND: Record<string, string> = { voice: "voice note", audio: "recording", image: "photograph", sketch: "sketch", video: "video", note: "note", text: "note", idea: "idea", document: "document", pdf: "document" };
const kindOf = (m: MomentRow) => (m.entity_type === "creation" ? "Creation" : (KIND[m.subtype ?? ""] ?? "Material"));
const month = (iso: string, now: number) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "long", ...(d.getUTCFullYear() !== new Date(now).getUTCFullYear() ? { year: "numeric" } : {}), timeZone: "UTC" });
};
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const DAY = 86_400_000;

export interface MomentRow {
  id: string;
  entity_type: string;
  entity_id: string;
  subtype: string | null;
  occurred_at: string;
  title: string | null;
}

/**
 * Deterministic candidates from recorded facts (pure, so it can be tested): the same day (a voice note and photographs
 * made together), a shared meaningful tag across time, and a fresh note that names an unfinished Creation.
 */
export function findCandidates(input: {
  now: number;
  moments: MomentRow[];
  /** material id → its tags */
  tags: Map<string, string[]>;
  /** pairs of moment ids that already share a DejaVu (already connected by the creator) */
  linked: Set<string>;
  /** unfinished Creations: moment id, title, and the Material ids already feeding it */
  drafts: Array<{ momentId: string; title: string; materialIds: Set<string> }>;
  /** material id → text to look for a draft's words in */
  text: Map<string, string>;
}): ConnectionCandidate[] {
  const { now, moments } = input;
  const out: ConnectionCandidate[] = [];
  const pair = (a: string, b: string) => [a, b].sort().join(",");
  const connected = (ids: string[]) => ids.some((a, i) => ids.slice(i + 1).some((b) => input.linked.has(pair(a, b))));
  const mats = moments.filter((m) => m.entity_type === "material");
  const recent = mats.filter((m) => Date.parse(m.occurred_at) >= now - 14 * DAY);

  // Same memory: a voice note (or recording) and photographs captured the same day.
  const byDay = new Map<string, MomentRow[]>();
  for (const m of mats) byDay.set(m.occurred_at.slice(0, 10), [...(byDay.get(m.occurred_at.slice(0, 10)) ?? []), m]);
  for (const [, same] of byDay) {
    const voice = same.find((m) => m.subtype === "voice" || m.subtype === "audio");
    const photos = same.filter((m) => m.subtype === "image").slice(0, 2);
    if (!voice || !photos.length) continue;
    const ids = [voice.id, ...photos.map((p) => p.id)];
    if (connected(ids)) continue;
    out.push({
      momentIds: ids,
      connectionType: "same_memory",
      shortExplanation: `Your ${kindOf(voice)} from ${month(voice.occurred_at, now)} and ${photos.length === 1 ? "a photograph" : "these two photographs"} may describe the same memory.`,
      evidence: [`All captured on ${day(voice.occurred_at)}`],
      confidence: 0.75,
    });
  }

  // A shared theme across time: a new Moment and a much older one carry the same meaningful tag.
  const byTag = new Map<string, MomentRow[]>();
  for (const m of mats) for (const t of input.tags.get(m.entity_id) ?? []) if (isMeaningfulName(t)) byTag.set(t.toLowerCase(), [...(byTag.get(t.toLowerCase()) ?? []), m]);
  for (const [tag, list] of byTag) {
    const fresh = list.filter((m) => recent.includes(m)).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
    const old = list.filter((m) => Date.parse(m.occurred_at) < now - 30 * DAY).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))[0];
    if (!fresh || !old || connected([fresh.id, old.id])) continue;
    out.push({
      momentIds: [old.id, fresh.id],
      connectionType: "shared_theme",
      shortExplanation: `Your ${kindOf(old)} from ${month(old.occurred_at, now)} and a new ${kindOf(fresh)} are both about “${tag}”.`,
      evidence: [`Both are tagged “${tag}”`],
      confidence: 0.7,
    });
  }

  // A creative opportunity: a fresh note names an unfinished Creation it isn't part of yet.
  const noteTypes = new Set<string>(NOTE_MATERIAL_TYPES);
  for (const d of input.drafts) {
    const words = d.title
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4 && isMeaningfulName(w));
    if (!words.length) continue;
    for (const m of recent) {
      if (!noteTypes.has(m.subtype ?? "") || d.materialIds.has(m.entity_id)) continue;
      const hay = ` ${(input.text.get(m.entity_id) ?? m.title ?? "").toLowerCase()} `;
      const hit = words.find((w) => new RegExp(`[^\\p{L}]${w}[^\\p{L}]`, "u").test(hay));
      if (!hit || connected([m.id, d.momentId])) continue;
      out.push({
        momentIds: [m.id, d.momentId],
        connectionType: "creative_opportunity",
        shortExplanation: `${Date.parse(m.occurred_at) >= now - DAY ? "Today's" : "A new"} ${kindOf(m)} may fit “${d.title}”.`,
        evidence: [`Both mention “${hit}”`, `“${d.title}” is still in progress`],
        confidence: 0.6,
      });
      break;
    }
  }
  // Mixed kinds make better connections than two of a kind; strongest first.
  return out.sort((a, b) => b.confidence - a.confidence).filter((c, i, all) => all.findIndex((x) => connectionSignature(x.connectionType, x.momentIds) === connectionSignature(c.connectionType, c.momentIds)) === i);
}

/**
 * Look for new connections for one creator and keep up to three. `db` is the creator's own client (their Moments,
 * tags and the search index, all through RLS); `service` writes the suggestions, scoped to that creator. Idempotent:
 * a connection already found — or dismissed — isn't written again.
 */
export async function discoverConnections(db: Db, service: Db, creatorId: string, now = Date.now()): Promise<number> {
  const [{ data: moments }, { data: links }, { data: drafts }] = await Promise.all([
    db
      .from("moment_references")
      .select("id, entity_type, entity_id, subtype, occurred_at, title")
      .eq("creator_id", creatorId)
      .is("deleted_at", null)
      .in("entity_type", ["material", "creation"])
      .order("occurred_at", { ascending: false })
      .limit(400),
    db.from("dejavu_moments").select("dejavu_id, moment_id").eq("creator_id", creatorId).limit(2000),
    db.from("artifacts").select("id, title, updated_at").eq("creator_id", creatorId).in("status", ["draft", "in_review"]).gt("updated_at", new Date(now - 30 * DAY).toISOString()).order("updated_at", { ascending: false }).limit(5),
  ]);
  const rows = (moments ?? []) as MomentRow[];
  if (rows.length < 2) return 0;
  const matIds = rows.filter((m) => m.entity_type === "material").map((m) => m.entity_id);
  const recentText = rows.filter((m) => m.entity_type === "material" && Date.parse(m.occurred_at) >= now - 14 * DAY).map((m) => m.entity_id);
  const [{ data: tags }, { data: texts }, { data: fed }] = await Promise.all([
    matIds.length ? db.from("creative_material_tags").select("material_id, tag").in("material_id", matIds.slice(0, 400)) : Promise.resolve({ data: [] as Array<{ material_id: string; tag: string }> }),
    recentText.length ? db.from("creative_materials").select("id, title, text_content").in("id", recentText.slice(0, 60)) : Promise.resolve({ data: [] as Array<{ id: string; title: string | null; text_content: string | null }> }),
    (drafts ?? []).length
      ? db.from("lineage_edges").select("source_id, target_id").eq("target_type", "artifact").eq("source_type", "material").in("target_id", (drafts ?? []).map((d) => d.id))
      : Promise.resolve({ data: [] as Array<{ source_id: string; target_id: string }> }),
  ]);
  const byDejaVu = new Map<string, string[]>();
  for (const l of links ?? []) byDejaVu.set(l.dejavu_id, [...(byDejaVu.get(l.dejavu_id) ?? []), l.moment_id]);
  const linked = new Set<string>();
  for (const ids of byDejaVu.values()) for (let i = 0; i < ids.length && i < 80; i++) for (let j = i + 1; j < ids.length && j < 80; j++) linked.add([ids[i]!, ids[j]!].sort().join(","));
  const tagMap = new Map<string, string[]>();
  for (const t of tags ?? []) tagMap.set(t.material_id, [...(tagMap.get(t.material_id) ?? []), t.tag]);
  const textMap = new Map((texts ?? []).map((t) => [t.id, `${t.title ?? ""}\n${(t.text_content ?? "").slice(0, 4000)}`]));
  const draftMoments = (drafts ?? [])
    .map((d) => ({ momentId: rows.find((m) => m.entity_type === "creation" && m.entity_id === d.id)?.id, title: d.title, materialIds: new Set((fed ?? []).filter((e) => e.target_id === d.id).map((e) => e.source_id)) }))
    .filter((d): d is { momentId: string; title: string; materialIds: Set<string> } => !!d.momentId);

  const candidates = findCandidates({ now, moments: rows, tags: tagMap, linked, drafts: draftMoments, text: textMap });

  // Closeness in what two Materials describe (the search index; nothing of it is shown): a new Material and a much older
  // one of a different kind.
  for (const m of rows.filter((r) => r.entity_type === "material" && Date.parse(r.occurred_at) >= now - 14 * DAY).slice(0, 4)) {
    const { data: near } = await db.rpc("similar_materials", { p_material: m.entity_id, p_limit: 4, p_min_similarity: 0.82 });
    for (const n of near ?? []) {
      const other = rows.find((r) => r.entity_type === "material" && r.entity_id === n.material_id);
      if (!other || Date.parse(other.occurred_at) >= now - 30 * DAY || filterOf({ entityType: "material", subtype: other.subtype }) === filterOf({ entityType: "material", subtype: m.subtype })) continue;
      if (linked.has([m.id, other.id].sort().join(","))) continue;
      candidates.push({
        momentIds: [other.id, m.id],
        connectionType: "shared_theme",
        shortExplanation: `Your ${kindOf(other)} from ${month(other.occurred_at, now)} and a new ${kindOf(m)} seem to be about the same thing.`,
        evidence: ["What they describe is close"],
        confidence: Math.min(0.95, Number(n.similarity)),
      });
      break;
    }
  }
  if (!candidates.length) return 0;
  const picks = candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  const res = await service
    .from("moment_connections")
    .upsert(
      picks.map((c) => ({
        creator_id: creatorId,
        moment_ids: c.momentIds,
        connection_type: c.connectionType,
        short_explanation: c.shortExplanation.slice(0, 200),
        evidence: c.evidence.slice(0, 4) as never,
        confidence_internal: Math.max(0, Math.min(1, c.confidence)),
        signature: connectionSignature(c.connectionType, c.momentIds),
        expires_at: new Date(now + 21 * DAY).toISOString(),
      })),
      { onConflict: "creator_id,signature", ignoreDuplicates: true },
    )
    .select("id");
  if (res.error) throw fromDbError(res.error);
  return res.data?.length ?? 0;
}

const toConnection = (r: { id: string; moment_ids: string[]; connection_type: string; short_explanation: string; evidence: unknown; status: string; created_at: string; expires_at: string | null }): MomentConnection => ({
  id: r.id,
  momentIds: r.moment_ids,
  connectionType: r.connection_type as ConnectionType,
  shortExplanation: r.short_explanation,
  evidence: Array.isArray(r.evidence) ? (r.evidence as string[]) : [],
  status: r.status as MomentConnection["status"],
  createdAt: r.created_at,
  expiresAt: r.expires_at,
});

/** The one connection worth showing now (new before opened; newest first), skipping expired ones and any whose Moments are gone. */
export async function currentConnection(db: Db, now = Date.now()): Promise<MomentConnection | null> {
  const { data, error } = await db
    .from("moment_connections")
    .select("id, moment_ids, connection_type, short_explanation, evidence, status, created_at, expires_at")
    .in("status", ["new", "opened"])
    .order("status", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw fromDbError(error);
  for (const r of data ?? []) {
    if (r.expires_at && Date.parse(r.expires_at) < now) continue;
    const { count } = await db.from("moment_references").select("id", { count: "exact", head: true }).in("id", r.moment_ids).is("deleted_at", null);
    if ((count ?? 0) === r.moment_ids.length) return toConnection(r);
  }
  return null;
}

export async function getConnection(db: Db, id: string): Promise<MomentConnection> {
  const { data } = await db.from("moment_connections").select("id, moment_ids, connection_type, short_explanation, evidence, status, created_at, expires_at").eq("id", id).maybeSingle();
  if (!data) throw new DomainError("not_found", "That connection isn't available.");
  return toConnection(data);
}

/** Opened, used (e.g. brought into the Studio) or dismissed — the creator's call; dismissed never returns. */
export async function resolveConnection(db: Db, id: string, status: "opened" | "dismissed" | "used"): Promise<void> {
  const res = await db.from("moment_connections").update({ status, resolved_at: new Date().toISOString() }).eq("id", id).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "That connection isn't available.");
}

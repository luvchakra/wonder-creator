import { DomainError, fromDbError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";

/**
 * Collaborator discovery (P1-10): find people by fit for the work — discipline, skills, interests, location,
 * availability, your existing relationship and a project's need — never by popularity. Every result carries the
 * factual signals behind it, turned into plain reasons. There is no score.
 */

export const AVAILABILITY = ["open", "selective", "closed"] as const;
export type Availability = (typeof AVAILABILITY)[number];
export const AVAILABILITY_LABEL: Record<Availability, string> = { open: "Open to collaborate", selective: "Selective about collaborations", closed: "Not taking collaborations" };

/**
 * Loose stem so "cinematographers" finds "Cinematography" and "editor" finds "Editing". Applied to the last word;
 * a stem is never shorter than four letters.
 */
export function stemTerm(term: string): string {
  const t = term.trim().toLowerCase().replace(/\s+/g, " ");
  const words = t.split(" ");
  const last = words.pop() ?? "";
  for (const suffix of ["ians", "ian", "ers", "ists", "ies", "ing", "ors", "er", "ist", "or", "s", "y"]) {
    if (last.endsWith(suffix) && last.length - suffix.length >= 4) return [...words, last.slice(0, -suffix.length)].join(" ");
  }
  return t;
}

export const discoverySchema = z.object({
  terms: z
    .array(z.string().trim().min(2).max(60))
    .max(8)
    .default([])
    .transform((ts) => [...new Set(ts.map(stemTerm))]),
  interest: z.string().trim().min(2).max(60).nullish(),
  location: z.string().trim().min(2).max(120).nullish(),
  availability: z.array(z.enum(AVAILABILITY)).min(1).max(3).default(["open", "selective"]),
  networkOnly: z.boolean().default(false),
  projectId: z.string().uuid().nullish(),
  limit: z.number().int().min(1).max(50).default(24),
});
export type DiscoveryQuery = z.infer<typeof discoverySchema>;

/** "cinematographer, sound design" → ["cinematographer", "sound design"]. */
export function parseTerms(input: string | null | undefined): string[] {
  return [
    ...new Set(
      (input ?? "")
        .split(/[,;\n]/)
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length >= 2 && t.length <= 60),
    ),
  ].slice(0, 8);
}

export interface CandidateSignals {
  matchedTerms: string[];
  interestMatch: boolean;
  locationMatch: boolean;
  sharedCrews: number;
  metInHuddles: number;
  workedTogether: number;
  iFollow: boolean;
  followsMe: boolean;
  publishedPieces: number;
  inProject: "active" | "invited" | null;
}

export interface CollaboratorCard {
  id: string;
  handle: string | null;
  name: string;
  bio: string | null;
  location: string | null;
  availability: Availability;
  disciplines: string[];
  skills: string[];
  interests: string[];
  languages: string[];
  signals: CandidateSignals;
  /** Why they're here, from facts only (what matched, how you know each other). */
  reasons: string[];
  /** In your network: crews, Huddles, pieces or follows in common. */
  known: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Plain-language reasons from the factual signals. Never a rating. */
export function explainCandidate(c: Pick<CollaboratorCard, "disciplines" | "skills" | "interests" | "location" | "availability">, s: CandidateSignals, q: Pick<DiscoveryQuery, "interest" | "location">): string[] {
  const out: string[] = [];
  if (s.matchedTerms.length) {
    const lists = [...c.disciplines.map((v) => ({ v, kind: "discipline" })), ...c.skills.map((v) => ({ v, kind: "skill" }))];
    for (const t of s.matchedTerms) {
      const hit = lists.find((x) => x.v.toLowerCase().includes(t));
      if (hit) out.push(`Lists ${hit.v} as a ${hit.kind}`);
    }
  }
  if (s.interestMatch && q.interest) out.push(`Interested in ${c.interests.find((i) => i.toLowerCase().includes(q.interest!.toLowerCase())) ?? q.interest}`);
  if (s.locationMatch && c.location) out.push(`Based in ${c.location}`);
  if (s.workedTogether) out.push(`You've worked together on ${plural(s.workedTogether, "Creation")}`);
  if (s.sharedCrews) out.push(`You've been in ${plural(s.sharedCrews, "crew")} together`);
  if (s.metInHuddles) out.push(`You've met in ${plural(s.metInHuddles, "Huddle")}`);
  if (s.iFollow && s.followsMe) out.push("You follow each other");
  else if (s.iFollow) out.push("You follow them");
  else if (s.followsMe) out.push("They follow you");
  if (s.publishedPieces) out.push(`Has published ${plural(s.publishedPieces, "Creation")}`);
  out.push(AVAILABILITY_LABEL[c.availability]);
  return out;
}

export async function findCollaborators(db: Db, raw: unknown): Promise<CollaboratorCard[]> {
  const q = discoverySchema.parse(raw);
  const { data, error } = await db.rpc("find_collaborators", {
    p_terms: q.terms,
    p_interest: q.interest ?? undefined,
    p_location: q.location ?? undefined,
    p_availability: q.availability,
    p_network_only: q.networkOnly,
    p_project: q.projectId ?? undefined,
    p_limit: q.limit,
  });
  if (error) throw fromDbError(error);
  return (data ?? []).map((r) => {
    const signals: CandidateSignals = {
      matchedTerms: r.matched_terms ?? [],
      interestMatch: r.interest_match,
      locationMatch: r.location_match,
      sharedCrews: r.shared_crews,
      metInHuddles: r.met_in_huddles,
      workedTogether: r.worked_together,
      iFollow: r.i_follow,
      followsMe: r.follows_me,
      publishedPieces: r.published_pieces,
      inProject: (r.in_project as CandidateSignals["inProject"]) ?? null,
    };
    const card = {
      id: r.creator_id,
      handle: r.handle,
      name: r.display_name || "Creator",
      bio: r.bio,
      location: r.location,
      availability: r.availability as Availability,
      disciplines: r.disciplines ?? [],
      skills: r.skills ?? [],
      interests: r.interests ?? [],
      languages: r.languages ?? [],
    };
    return { ...card, signals, reasons: explainCandidate(card, signals, q), known: signals.sharedCrews > 0 || signals.metInHuddles > 0 || signals.workedTogether > 0 || signals.iFollow || signals.followsMe };
  });
}

export interface ShortlistEntry {
  id: string;
  candidate: { id: string; name: string; handle: string | null; disciplines: string[] };
  projectId: string | null;
  note: string | null;
  at: string;
}

export async function listShortlist(db: Db, creatorId: string, projectId?: string | null): Promise<ShortlistEntry[]> {
  let q = db
    .from("collaborator_shortlist")
    .select("id, project_id, note, created_at, candidate:creators!collaborator_shortlist_candidate_creator_id_fkey(id, display_name, handle, creator_disciplines(value))")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(200);
  q = projectId ? q.eq("project_id", projectId) : q.is("project_id", null);
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  return (data ?? [])
    .filter((r) => r.candidate)
    .map((r) => {
      const c = r.candidate as unknown as { id: string; display_name: string; handle: string | null; creator_disciplines: Array<{ value: string }> };
      return { id: r.id, candidate: { id: c.id, name: c.display_name || "Creator", handle: c.handle, disciplines: (c.creator_disciplines ?? []).map((d) => d.value) }, projectId: r.project_id, note: r.note, at: r.created_at };
    });
}

export const shortlistSchema = z.object({ candidateId: z.string().uuid(), projectId: z.string().uuid().nullish(), note: z.string().trim().max(500).nullish() });

export async function addToShortlist(db: Db, creatorId: string, raw: unknown): Promise<string> {
  const s = shortlistSchema.parse(raw);
  if (s.candidateId === creatorId) throw new DomainError("validation", "You can't shortlist yourself.");
  const { data, error } = await db
    .from("collaborator_shortlist")
    .upsert({ creator_id: creatorId, candidate_creator_id: s.candidateId, project_id: s.projectId ?? null, note: s.note || null }, { onConflict: "creator_id,candidate_creator_id,project_id" })
    .select("id")
    .single();
  if (error?.code === "42501") throw new DomainError("not_found", "We couldn't find that creator.");
  if (error) throw fromDbError(error);
  return data.id;
}

export async function removeFromShortlist(db: Db, id: string) {
  const { data, error } = await db.from("collaborator_shortlist").delete().eq("id", id).select("id");
  if (error) throw fromDbError(error);
  if (!data?.length) throw new DomainError("not_found", "That's not on your shortlist.");
}

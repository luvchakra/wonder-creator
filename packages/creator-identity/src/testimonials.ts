import { DomainError, fromDbError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { TESTIMONIALS_FROM, type TestimonialsFrom } from "./testimonials-options";

/**
 * Testimonials (docs/testimonials.md, owner 2 Oct 2026): as Orkut had them. Someone who knows your work writes a short
 * note about you; it shows on your Profile only once you choose to show it, and you can hide it any time. Written by
 * people, never by AI; approved by the receiver; newest first; no counts and no ranking. All changes go through the
 * database functions (audited); this module only shapes inputs and rows.
 */

export * from "./testimonials-options";

export type TestimonialStatus = "pending" | "shown" | "hidden" | "withdrawn";
export type TestimonialContextType = "project" | "artifact" | "huddle";

export interface Testimonial {
  id: string;
  from: { id: string; name: string; handle: string | null; avatarObjectId: string | null };
  body: string;
  status: TestimonialStatus;
  onCreatorPage: boolean;
  createdAt: string;
  decidedAt: string | null;
  /** Something the two share, checked by the server (its title when readable). */
  context: { type: TestimonialContextType; id: string; label: string | null } | null;
  /** Derived by the platform (shared crew, Creation or Huddle), never claimed. */
  workedTogether: boolean;
}

export const testimonialSchema = z.object({
  to: z.string().uuid(),
  body: z.string().trim().min(10, "Say a little more — at least a sentence.").max(600, "Keep it under 600 characters."),
  context: z.object({ type: z.enum(["project", "artifact", "huddle"]), id: z.string().uuid() }).nullable().optional(),
});

export const testimonialDecisionSchema = z.object({
  action: z.enum(["show", "hide"]),
  onCreatorPage: z.boolean().optional(),
});

export const testimonialsSettingSchema = z.object({ from: z.enum(TESTIMONIALS_FROM) });

/** Someone's testimonials as the viewer may see them (shown ones; the receiver also sees pending and hidden). */
export async function testimonialsOf(db: Db, creatorId: string): Promise<Testimonial[]> {
  const { data, error } = await db.rpc("testimonials_of", { p_creator: creatorId });
  if (error) throw fromDbError(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    from: { id: r.from_id, name: r.from_name || "Creator", handle: r.from_handle, avatarObjectId: r.from_avatar_object_id },
    body: r.body,
    status: r.status as TestimonialStatus,
    onCreatorPage: r.on_creator_page,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
    context: r.context_type && r.context_id ? { type: r.context_type as TestimonialContextType, id: r.context_id, label: r.context_label } : null,
    workedTogether: r.worked_together,
  }));
}

/** Write (or rewrite) your testimonial for someone. A rewrite waits for their decision again. */
export async function writeTestimonial(db: Db, raw: unknown): Promise<string> {
  const input = testimonialSchema.parse(raw);
  const { data, error } = await db.rpc("testimonial_write", {
    p_to: input.to,
    p_body: input.body,
    p_context_type: input.context?.type ?? undefined,
    p_context_id: input.context?.id ?? undefined,
  });
  if (error) {
    if (error.code === "42501") throw new DomainError("forbidden", "You can't write a testimonial for this creator right now.");
    if (error.code === "22023") throw new DomainError("validation", "Pick something you both were part of, or leave it out.");
    throw fromDbError(error);
  }
  return data as string;
}

export async function withdrawTestimonial(db: Db, toCreatorId: string): Promise<void> {
  const { error } = await db.rpc("testimonial_withdraw", { p_to: toCreatorId });
  if (error) throw error.code === "P0002" ? new DomainError("not_found", "You haven't written a testimonial for this creator.") : fromDbError(error);
}

/** The receiver shows a testimonial on their Profile (optionally also on their public Creator Page) or keeps it private. */
export async function decideTestimonial(db: Db, id: string, raw: unknown): Promise<void> {
  const input = testimonialDecisionSchema.parse(raw);
  const { error } = await db.rpc("testimonial_decide", { p_id: id, p_action: input.action, p_on_creator_page: input.onCreatorPage ?? undefined });
  if (error) {
    if (error.code === "P0002") throw new DomainError("not_found", "We couldn't find that testimonial.");
    if (error.code === "42501") throw new DomainError("forbidden", "Its writer withdrew this testimonial.");
    throw fromDbError(error);
  }
}

export async function setTestimonialsFrom(db: Db, raw: unknown): Promise<TestimonialsFrom> {
  const { from } = testimonialsSettingSchema.parse(raw);
  const { error } = await db.rpc("testimonials_setting", { p_from: from });
  if (error) throw fromDbError(error);
  return from;
}

export async function testimonialsFromOf(db: Db, creatorId: string): Promise<TestimonialsFrom> {
  const { data } = await db.from("creators").select("testimonials_from").eq("id", creatorId).maybeSingle();
  return ((data?.testimonials_from as TestimonialsFrom | undefined) ?? "anyone") as TestimonialsFrom;
}

/** Could the viewer write one for this creator? The database decides (setting, profile visibility, blocks). */
export async function canWriteTestimonial(db: Db, viewerId: string, creatorId: string): Promise<boolean> {
  if (viewerId === creatorId) return false;
  const { data } = await db.rpc("can_write_testimonial_for", { p_creator: creatorId });
  return data === true;
}

/** Things the viewer and the creator share, for the writer to point at: crews (Creative Rooms) and Creations. */
export async function sharedContexts(db: Db, viewerId: string, creatorId: string): Promise<Array<{ type: TestimonialContextType; id: string; label: string }>> {
  const [{ data: mine }, { data: theirs }, { data: onMine }, { data: onTheirs }] = await Promise.all([
    db.from("crew_members").select("crew_id").eq("creator_id", viewerId).eq("status", "active").limit(200),
    db.from("crew_members").select("crew_id").eq("creator_id", creatorId).eq("status", "active").limit(200),
    db.from("artifact_contributors").select("artifact_id, artifacts!inner(id, title, creator_id)").eq("contributor_creator_id", creatorId).eq("artifacts.creator_id", viewerId).limit(50),
    db.from("artifact_contributors").select("artifact_id, artifacts!inner(id, title, creator_id)").eq("contributor_creator_id", viewerId).eq("artifacts.creator_id", creatorId).limit(50),
  ]);
  const shared = new Set((theirs ?? []).map((m) => m.crew_id));
  const crewIds = [...new Set((mine ?? []).map((m) => m.crew_id).filter((id) => shared.has(id)))];
  const rooms = crewIds.length ? ((await db.from("crews").select("project_id, projects!inner(id, title)").in("id", crewIds)).data ?? []) : [];
  const out: Array<{ type: TestimonialContextType; id: string; label: string }> = [];
  for (const r of rooms) {
    const p = r.projects as { id: string; title: string } | null;
    if (p && !out.some((x) => x.id === p.id)) out.push({ type: "project", id: p.id, label: p.title });
  }
  for (const c of [...(onMine ?? []), ...(onTheirs ?? [])]) {
    const a = c.artifacts as { id: string; title: string } | null;
    if (a && !out.some((x) => x.id === a.id)) out.push({ type: "artifact", id: a.id, label: a.title });
  }
  return out.slice(0, 12);
}

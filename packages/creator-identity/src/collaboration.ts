import { audit, DomainError, fromDbError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";

export * from "./collaboration-options";

/**
 * P1-14 Creator Availability & Collaboration Profile: how a creator wants to collaborate. Availability, disciplines
 * and languages stay on the creator's profile; this is the rest. Rate guidance is private unless the creator chooses
 * otherwise, and others only ever read the profile through `collaboration_profile_of` (which applies that choice).
 */

const words = z.array(z.string().trim().min(1).max(60)).max(12);
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

export const collaborationProfileSchema = z.object({
  projectTypes: words.default([]),
  interests: words.default([]),
  workMode: z.enum(["either", "remote", "local"]).default("either"),
  region: text(120),
  turnaround: text(120),
  contactPreference: z.enum(["anyone", "network"]).default("anyone"),
  commercialBoundaries: text(1000),
  rateGuidance: text(300),
  rateVisibility: z.enum(["private", "collaborators", "public"]).default("private"),
  rightsPreferences: text(1000),
  exclusivity: z.enum(["open", "case_by_case", "non_exclusive_only"]).default("open"),
});
export type CollaborationProfileInput = z.input<typeof collaborationProfileSchema>;
export type CollaborationProfile = z.output<typeof collaborationProfileSchema>;

/** What another creator sees (rate guidance only when its owner allows it). */
export interface PublicCollaborationProfile {
  availability: "open" | "selective" | "closed";
  projectTypes: string[];
  interests: string[];
  workMode: "either" | "remote" | "local";
  region: string | null;
  turnaround: string | null;
  contactPreference: "anyone" | "network";
  commercialBoundaries: string | null;
  rightsPreferences: string | null;
  exclusivity: "open" | "case_by_case" | "non_exclusive_only";
  rateGuidance: string | null;
  hasProfile: boolean;
}

const dedupe = (list: string[]) => [...new Map(list.map((v) => [v.toLowerCase(), v])).values()];

/** The creator's own profile (defaults when they haven't filled it in). */
export async function getCollaborationProfile(db: Db, creatorId: string): Promise<CollaborationProfile> {
  const { data, error } = await db.from("collaboration_profiles").select("*").eq("creator_id", creatorId).maybeSingle();
  if (error) throw fromDbError(error);
  return collaborationProfileSchema.parse(
    data
      ? {
          projectTypes: data.project_types,
          interests: data.interests,
          workMode: data.work_mode,
          region: data.region,
          turnaround: data.turnaround,
          contactPreference: data.contact_preference,
          commercialBoundaries: data.commercial_boundaries,
          rateGuidance: data.rate_guidance,
          rateVisibility: data.rate_visibility,
          rightsPreferences: data.rights_preferences,
          exclusivity: data.exclusivity,
        }
      : {},
  );
}

export async function saveCollaborationProfile(db: Db, creatorId: string, input: unknown): Promise<CollaborationProfile> {
  const p = collaborationProfileSchema.parse(input);
  const { error } = await db.from("collaboration_profiles").upsert({
    creator_id: creatorId,
    project_types: dedupe(p.projectTypes),
    interests: dedupe(p.interests),
    work_mode: p.workMode,
    region: p.region,
    turnaround: p.turnaround,
    contact_preference: p.contactPreference,
    commercial_boundaries: p.commercialBoundaries,
    rate_guidance: p.rateGuidance,
    // No rate, nothing to show: keep the visibility honest.
    rate_visibility: p.rateGuidance ? p.rateVisibility : "private",
    rights_preferences: p.rightsPreferences,
    exclusivity: p.exclusivity,
  });
  if (error) throw fromDbError(error);
  // The audit keeps choices, never the rate itself.
  await audit(db, { action: "collaboration_profile.update", objectType: "creator", objectId: creatorId, metadata: { contactPreference: p.contactPreference, rateVisibility: p.rateGuidance ? p.rateVisibility : "private" } });
  return getCollaborationProfile(db, creatorId);
}

/** Another creator's profile as the viewer may see it; null when they can't. */
export async function collaborationProfileOf(db: Db, creatorId: string): Promise<PublicCollaborationProfile | null> {
  const { data, error } = await db.rpc("collaboration_profile_of", { p_creator: creatorId });
  if (error) throw fromDbError(error);
  if (data !== null && typeof data !== "object") throw new DomainError("internal", "Unexpected collaboration profile.");
  return (data as PublicCollaborationProfile | null) ?? null;
}

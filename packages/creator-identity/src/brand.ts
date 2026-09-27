import { audit, DomainError, fromDbError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";

/**
 * P1-15 Brand Affiliation Foundation (creator side): whether a creator is open to brand work and what they'd take on.
 * No marketplace, pricing or payments. Others only ever see the short summary from `brand_summary_of`, and only when
 * the creator opted in; boundaries, exclusivity, usage rights and prior collaborations stay with the creator.
 */

const list = (max: number) => z.array(z.string().trim().min(1).max(80)).max(max).default([]);
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

export const brandProfileSchema = z.object({
  openToBrands: z.boolean().default(false),
  niches: list(12),
  industries: list(12),
  regions: list(12),
  expertise: list(12),
  platforms: list(12),
  deliverables: list(12),
  priorCollaborations: list(20),
  turnaround: text(120),
  commercialBoundaries: text(1000),
  exclusivity: text(500),
  usageRights: text(1000),
});
export type BrandProfile = z.output<typeof brandProfileSchema>;
export interface BrandSummary {
  niches: string[];
  industries: string[];
  platforms: string[];
  deliverables: string[];
}

const dedupe = (l: string[]) => [...new Map(l.map((v) => [v.toLowerCase(), v])).values()];

export async function getBrandProfile(db: Db, creatorId: string): Promise<BrandProfile> {
  const { data, error } = await db.from("brand_profiles").select("*").eq("creator_id", creatorId).maybeSingle();
  if (error) throw fromDbError(error);
  return brandProfileSchema.parse(
    data
      ? {
          openToBrands: data.open_to_brands,
          niches: data.niches,
          industries: data.industries,
          regions: data.regions,
          expertise: data.expertise,
          platforms: data.platforms,
          deliverables: data.deliverables,
          priorCollaborations: data.prior_collaborations,
          turnaround: data.turnaround,
          commercialBoundaries: data.commercial_boundaries,
          exclusivity: data.exclusivity,
          usageRights: data.usage_rights,
        }
      : {},
  );
}

export async function saveBrandProfile(db: Db, creatorId: string, input: unknown): Promise<BrandProfile> {
  const p = brandProfileSchema.parse(input);
  if (p.openToBrands && !p.niches.length && !p.deliverables.length) throw new DomainError("validation", "Add at least one niche or deliverable so brands know what you'd make.");
  const { error } = await db.from("brand_profiles").upsert({
    creator_id: creatorId,
    open_to_brands: p.openToBrands,
    niches: dedupe(p.niches),
    industries: dedupe(p.industries),
    regions: dedupe(p.regions),
    expertise: dedupe(p.expertise),
    platforms: dedupe(p.platforms),
    deliverables: dedupe(p.deliverables),
    prior_collaborations: dedupe(p.priorCollaborations),
    turnaround: p.turnaround,
    commercial_boundaries: p.commercialBoundaries,
    exclusivity: p.exclusivity,
    usage_rights: p.usageRights,
  });
  if (error) throw fromDbError(error);
  await audit(db, { action: "brand_profile.update", objectType: "creator", objectId: creatorId, metadata: { openToBrands: p.openToBrands } });
  return getBrandProfile(db, creatorId);
}

/** The "open to brand work" summary another creator may see; null unless the creator opted in. */
export async function brandSummaryOf(db: Db, creatorId: string): Promise<BrandSummary | null> {
  const { data, error } = await db.rpc("brand_summary_of", { p_creator: creatorId });
  if (error) throw fromDbError(error);
  return (data as BrandSummary | null) ?? null;
}

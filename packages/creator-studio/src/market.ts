import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db, Tables } from "@wonder/db";
import { z } from "zod";
import { LICENSE_USES, usageChannelsSchema } from "./licensing";

/**
 * CreatorMarket Foundation (P1-18, plan §39): a creator's offer of a license on their own Creation — the terms,
 * price metadata, quantity/edition, availability and state. Architecture only: there are no purchases or payments,
 * and the app keeps it behind a feature flag until the transaction path is production-ready. The database decides
 * eligibility and every state change (`market_set_listing_state`); this module validates input and says why in words.
 */

export const LISTING_STATES = ["draft", "listed", "paused", "withdrawn", "sold_out"] as const;
export type ListingState = (typeof LISTING_STATES)[number];

const date = z.string().date().or(z.literal("")).nullish().transform((v) => v || null);

export const listingFields = z.object({
  title: z.string().trim().min(1, "Give the offer a title.").max(120),
  summary: z.string().trim().max(1000).nullish().transform((v) => v || null),
  licenseType: z.enum(LICENSE_USES.map((u) => u.value) as [string, ...string[]]),
  exclusive: z.boolean().default(false),
  territory: z.string().trim().min(1).max(120).default("Worldwide"),
  durationDays: z.coerce.number().int().min(1).max(36500).nullish().transform((v) => v ?? null),
  usageChannels: usageChannelsSchema,
  derivativesAllowed: z.boolean().default(false),
  attributionRequired: z.boolean().default(true),
  priceAmount: z.coerce.number().min(0).max(1e11).nullish().transform((v) => v ?? null),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, like INR or USD.").nullish().transform((v) => v || null),
  editionSize: z.coerce.number().int().min(1).max(100_000).nullish().transform((v) => v ?? null),
  availableFrom: date,
  availableUntil: date,
});

export const listingSchema = listingFields
  .refine((l) => (l.priceAmount == null) === (l.currency == null), { message: "A price needs both an amount and a currency.", path: ["currency"] })
  .refine((l) => !l.exclusive || l.editionSize == null || l.editionSize === 1, { message: "An exclusive offer is a single license.", path: ["editionSize"] })
  .refine((l) => !l.availableFrom || !l.availableUntil || l.availableUntil >= l.availableFrom, { message: "The end date is before the start date.", path: ["availableUntil"] });
export type ListingInput = z.infer<typeof listingSchema>;

/** Why a listing can't go live yet — facts from the records, in plain words (never a legal conclusion). */
export const INELIGIBLE_REASON: Record<string, string> = {
  not_owner: "Only the Creation's owner can offer it.",
  not_finished: "Mark the Creation as completed first.",
  no_rights_record: "This Creation has no rights record yet.",
  ownership_transferred: "Ownership was transferred, so it can't be offered from here.",
  ownership_incomplete: "Owners' shares don't add up to 100%.",
  no_copyright_holder: "Name the copyright holder in the Rights tab.",
  commercial_not_offered: "Commercial use is set to “Not offered” for this Creation.",
  derivatives_not_allowed: "The rights record doesn't allow derivative works.",
  active_license_conflict: "An active license of the same use already exists, so this can't be exclusive.",
  listing_conflict: "Another live offer for the same use conflicts with this one.",
  availability_ended: "The availability window has already ended.",
};

export type Listing = Tables<"market_listings">;

function toRow(l: ListingInput) {
  return {
    title: l.title,
    summary: l.summary,
    license_type: l.licenseType,
    exclusive: l.exclusive,
    territory: l.territory,
    duration_days: l.durationDays,
    usage_channels: l.usageChannels,
    derivatives_allowed: l.derivativesAllowed,
    attribution_required: l.attributionRequired,
    price_amount: l.priceAmount,
    currency: l.currency,
    edition_size: l.exclusive ? 1 : l.editionSize,
    available_from: l.availableFrom,
    available_until: l.availableUntil,
  };
}

/** A draft offer on one of the creator's own Creations (RLS: owner only, starts as a draft). */
export async function createListing(db: Db, creatorId: string, artifactId: string, raw: unknown): Promise<Listing> {
  const l = listingSchema.parse(raw);
  const res = await db.from("market_listings").insert({ creator_id: creatorId, artifact_id: artifactId, ...toRow(l) }).select("*").single();
  if (res.error) throw res.error.code === "42501" ? new DomainError("not_found", "That Creation isn't available.") : fromDbError(res.error);
  await db.rpc("record_domain_event", { p_event_type: "MarketListingCreated", p_aggregate_type: "market_listing", p_aggregate_id: res.data.id, p_payload: { artifactId, licenseType: l.licenseType, exclusive: l.exclusive } });
  return res.data;
}

/** Change the terms while a draft or paused (live offers are paused first, so terms never change under a buyer). */
export async function updateListing(db: Db, id: string, raw: unknown): Promise<Listing> {
  const l = listingSchema.parse(raw);
  const res = await db.from("market_listings").update(toRow(l)).eq("id", id).select("*");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("conflict", "Only a draft or paused offer can be changed. Pause it first.");
  return res.data[0]!;
}

export async function deleteDraftListing(db: Db, id: string): Promise<void> {
  const res = await db.from("market_listings").delete().eq("id", id).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("conflict", "Only a draft can be deleted. Withdraw a live offer instead.");
}

export async function listListings(db: Db, opts: { artifactId?: string } = {}): Promise<Listing[]> {
  let q = db.from("market_listings").select("*").order("updated_at", { ascending: false }).limit(100);
  if (opts.artifactId) q = q.eq("artifact_id", opts.artifactId);
  return must(await q);
}

/** A listing with, for its owner, what's still missing before it could go live. */
export async function getListing(db: Db, id: string): Promise<{ listing: Listing; missing: string[] }> {
  const listing = must(await db.from("market_listings").select("*").eq("id", id).maybeSingle(), "We couldn't find that offer.");
  const { data, error } = await db.rpc("market_listing_readiness", { p_listing: id });
  if (error) throw fromDbError(error);
  return { listing, missing: ((data as string[] | null) ?? []).map((r) => INELIGIBLE_REASON[r] ?? r) };
}

/** List, pause or withdraw. The database checks ownership and eligibility and records the event. */
export async function setListingState(db: Db, id: string, state: "listed" | "paused" | "withdrawn"): Promise<Listing> {
  const res = await db.rpc("market_set_listing_state", { p_listing: id, p_state: state });
  if (res.error) {
    const m = /not eligible: (.+)$/.exec(res.error.message ?? "");
    if (m) throw new DomainError("validation", m[1]!.split(",").map((r) => INELIGIBLE_REASON[r] ?? r).join(" "));
    if (res.error.code === "P0002") throw new DomainError("not_found", "We couldn't find that offer.");
    if (res.error.code === "55000") throw new DomainError("conflict", res.error.message.replace(/^./, (c) => c.toUpperCase()) + ".");
    throw fromDbError(res.error);
  }
  return res.data as Listing;
}

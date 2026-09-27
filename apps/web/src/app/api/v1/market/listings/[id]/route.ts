import { DomainError } from "@wonder/core";
import { deleteDraftListing, getListing, updateListing } from "@wonder/creator-studio";
import { readJson, withApi } from "@/lib/api";
import { features, requireFeature } from "@/lib/features";

const check = (id: string) => {
  requireFeature(features.market());
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("not_found", "We couldn't find that offer.");
};

/** GET /api/v1/market/listings/:id — an offer, and (for its owner) what's missing before it could go live. */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => {
  check(id);
  return getListing(db, id);
});

/** PATCH /api/v1/market/listings/:id — change the terms of a draft or paused offer. */
export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  check(id);
  return { listing: await updateListing(db, id, await readJson(req)) };
});

/** DELETE /api/v1/market/listings/:id — delete a draft. */
export const DELETE = withApi<{ id: string }>(async ({ db }, { id }) => {
  check(id);
  await deleteDraftListing(db, id);
  return { ok: true };
});

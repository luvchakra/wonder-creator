import { DomainError } from "@wonder/core";
import { setListingState } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { features, requireFeature } from "@/lib/features";

/** POST /api/v1/market/listings/:id/state — list, pause or withdraw an offer (eligibility is checked in the database). */
export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  requireFeature(features.market());
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("not_found", "We couldn't find that offer.");
  const b = z.object({ state: z.enum(["listed", "paused", "withdrawn"]) }).parse(await readJson(req));
  return { listing: await setListingState(db, id, b.state) };
});

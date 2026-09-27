import { DomainError } from "@wonder/core";
import { createListing, listListings } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { features, requireFeature } from "@/lib/features";

/** GET /api/v1/market/listings — the creator's offers (and live offers they can see). Behind the market flag. */
export const GET = withApi(async ({ db, req }) => {
  requireFeature(features.market());
  const artifactId = req.nextUrl.searchParams.get("artifactId");
  if (artifactId && !/^[0-9a-f-]{36}$/i.test(artifactId)) throw new DomainError("validation", "Unknown Creation.");
  return { listings: await listListings(db, { artifactId: artifactId ?? undefined }) };
});

/** POST /api/v1/market/listings — a draft offer on one of your Creations. Behind the market flag. */
export const POST = withApi(async ({ db, creatorId, req }) => {
  requireFeature(features.market());
  const body = (await readJson(req)) as Record<string, unknown>;
  const artifactId = z.string().uuid().parse(body.artifactId);
  return { listing: await createListing(db, creatorId, artifactId, body) };
});

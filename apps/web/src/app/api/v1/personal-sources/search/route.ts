import { DomainError } from "@wonder/core";
import { requestSync, searchTerms } from "@wonder/creator-sources/server";
import { after } from "next/server";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { drainSync, searchIndex, sourcesDeps } from "@/lib/sources";

export const maxDuration = 60;

/** GET /api/v1/personal-sources/search?q= — search what discovery already found (the creator's own index). */
export const GET = withApi(
  async ({ db, req }) => {
    const terms = searchTerms(req.nextUrl.searchParams.get("q"));
    if (!terms) return { items: [] };
    return { items: await searchIndex(db, terms) };
  },
  { feature: "personal_sources_enabled" },
);

const schema = z.object({ query: z.string().max(200) });

/**
 * POST /api/v1/personal-sources/search — "Look further back for …" (spec §6): a targeted, bounded search of each
 * connected source for the creator's words. Same budgets, dedupe and isolation as any sync; 202 with the jobs.
 */
export const POST = withApi(
  async ({ creatorId, req }) => {
    const { query } = schema.parse(await readJson(req));
    if (!searchTerms(query)) throw new DomainError("validation", "Search for at least two letters.");
    const out = await requestSync(sourcesDeps(), creatorId, { query });
    if (out.jobs.some((j) => !j.reused)) after(() => drainSync(creatorId));
    return Response.json(out, { status: 202 });
  },
  { feature: "personal_sources_enabled", rateLimit: 10 },
);

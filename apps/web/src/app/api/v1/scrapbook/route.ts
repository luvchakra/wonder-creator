import { createPost, listPosts } from "@wonder/creator-library";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";

const feed = z.object({
  scope: z.enum(["everyone", "following", "creator"]).default("everyone"),
  creator: z.string().uuid().optional(),
  before: z.string().datetime({ offset: true }).optional(),
});

/** Chronological Scrapbook feeds (everyone you can see, people you follow, or one creator). Never ranked. */
export const GET = withApi(async ({ db, creatorId, req }) => {
  const f = feed.parse(Object.fromEntries(req.nextUrl.searchParams));
  const scope = f.scope === "creator" && f.creator ? { scope: "creator" as const, authorId: f.creator } : f.scope === "following" ? { scope: "following" as const, creatorId } : { scope: "everyone" as const };
  return listPosts(db, creatorId, scope, { before: f.before });
});

export const POST = withApi(async ({ db, creatorId, req }) => ({ id: await createPost(db, creatorId, await readJson(req, 50_000)) }), { rateLimit: 20 });

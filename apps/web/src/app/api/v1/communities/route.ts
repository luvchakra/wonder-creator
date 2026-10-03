import { communityPrivacySchema, joinCommunity, listCommunities, setCommunityPrivacy } from "@wonder/creator-community";
import { createProject } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";

/** GET /api/v1/communities?q= — Public communities anyone signed in can find, latest activity first (never by popularity). */
export const GET = withApi(async ({ db, req }) => ({ communities: await listCommunities(db, { query: req.nextUrl.searchParams.get("q") ?? undefined }) }), {
  feature: "communities_enabled",
});

const startSchema = z.object({
  title: z.string().trim().min(3, "Give your community a name.").max(120),
  about: z.string().trim().max(2000).default(""),
  privacy: communityPrivacySchema.default("public"),
});

/**
 * POST /api/v1/communities — start a community: a Creative Room of your own (the existing Projects domain), Public,
 * Unlisted or Private. You're its owner.
 */
export const POST = withApi(
  async ({ db, creatorId, req }) => {
    const b = startSchema.parse(await readJson(req));
    const room = await createProject(db, creatorId, { title: b.title, brief: b.about, status: "active" });
    await setCommunityPrivacy(db, room.id, b.privacy);
    await joinCommunity(db, room.id);
    return Response.json({ id: room.id }, { status: 201 });
  },
  { feature: "communities_enabled", rateLimit: 5 },
);

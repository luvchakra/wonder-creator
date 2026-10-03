import { DomainError } from "@wonder/core";
import { communityMembers, communityPrivacySchema, communityTopics, getCommunity, setCommunityPrivacy } from "@wonder/creator-community";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** GET /api/v1/communities/:id — the community, its topics and members, as the viewer may see them. */
export const GET = withApi<{ id: string }>(
  async ({ db }, { id }) => {
    const pid = requireUuid(id, "community");
    const community = await getCommunity(db, pid);
    if (!community) throw new DomainError("not_found", "We couldn't find that community.");
    const [topics, members] = await Promise.all([communityTopics(db, pid), communityMembers(db, pid)]);
    return { community, topics, members };
  },
  { feature: "communities_enabled" },
);

const schema = z.object({ privacy: communityPrivacySchema });

/**
 * PATCH /api/v1/communities/:id `{privacy}` — the owner opens their Creative Room as a community (Public, Unlisted or
 * Private) or changes who can find it. A community stays one; it can go Private.
 */
export const PATCH = withApi<{ id: string }>(
  async ({ db, req }, { id }) => {
    const pid = requireUuid(id, "community");
    const { privacy } = schema.parse(await readJson(req));
    await setCommunityPrivacy(db, pid, privacy);
    return { ok: true, privacy };
  },
  { feature: "communities_enabled", rateLimit: 20 },
);

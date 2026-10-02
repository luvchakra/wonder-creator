import { DomainError } from "@wonder/core";
import { communityMembers, communityTopics, getCommunity, openAsCommunity } from "@wonder/creator-community";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** GET /api/v1/communities/:id — the community, its topics and members, as anyone signed in may see them. */
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

// Communities are always public (owner, 2 Oct 2026): a room can be opened as one, never made private again.
const schema = z.object({ discoverable: z.literal(true, { message: "A community is always public." }) });

/** PATCH /api/v1/communities/:id `{discoverable: true}` — the owner opens their Creative Room as a community. */
export const PATCH = withApi<{ id: string }>(
  async ({ db, req }, { id }) => {
    const pid = requireUuid(id, "community");
    const { discoverable } = schema.parse(await readJson(req));
    await openAsCommunity(db, pid);
    return { ok: true, discoverable };
  },
  { feature: "communities_enabled", rateLimit: 20 },
);

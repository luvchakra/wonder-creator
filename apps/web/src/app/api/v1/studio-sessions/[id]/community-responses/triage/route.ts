import { createHash } from "node:crypto";
import { isDomainError, log } from "@wonder/core";
import { selectProvider, triageReplies, type TriageGroup } from "@wonder/creator-brain";
import { communityResponses } from "@wonder/creator-studio";
import { withApi } from "@/lib/api";
import { assertUuid } from "@/lib/studio";

const cache = new Map<string, TriageGroup[]>();

/**
 * GET /api/v1/studio-sessions/:id/community-responses/triage — the replies to what the creator asked, grouped by what
 * they suggest ("2 suggest shortening the line", Phase 05 §10). An optional enhancement: asked for after the list is on
 * screen, cached for the same set of replies, empty when there's no live model or too few replies. Nothing is applied.
 */
export const GET = withApi<{ id: string }>(
  async ({ db, creatorId }, { id }) => {
    assertUuid(id);
    const { responses } = await communityResponses(db, id);
    const provider = selectProvider();
    if (!provider.live || responses.length < 3) return { groups: [] };
    const key = createHash("sha256")
      .update(`${creatorId}:${responses.map((r) => r.id).sort().join(",")}`)
      .digest("hex");
    const hit = cache.get(key);
    if (hit) return { groups: hit };
    try {
      const first = responses[0]!;
      const groups = (await triageReplies(provider, { question: first.conversationTitle, about: first.about, replies: responses.map((r) => ({ id: r.id, text: r.body })) })) ?? [];
      if (cache.size > 500) cache.delete(cache.keys().next().value as string);
      cache.set(key, groups);
      return { groups };
    } catch (e) {
      log("warn", "studio.triage_failed", { code: isDomainError(e) ? e.code : "internal" });
      return { groups: [] };
    }
  },
  { feature: "community_to_studio_enabled", rateLimit: 30 },
);

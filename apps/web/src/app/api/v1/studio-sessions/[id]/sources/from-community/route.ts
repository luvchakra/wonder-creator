import { addSources, COMMUNITY_SOURCE_TYPES, workingSetView, type SourceType } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { assertUuid, studioSigner } from "@/lib/studio";
import { track } from "@/lib/telemetry";

const schema = z.object({ type: z.enum(COMMUNITY_SOURCE_TYPES as [SourceType, ...SourceType[]]), id: z.string().uuid() });

/**
 * POST /api/v1/studio-sessions/:id/sources/from-community — "Bring to Studio" / "Use in Studio" (Phase 04 §6–7): an
 * Open Conversation, a reply in one or a Scrapbook entry joins the Working Table, Available, by reference, keeping who
 * said it. Only what the creator can already read (the database checks); someone else's words are reference only.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    assertUuid(id);
    const b = schema.parse(await readJson(req));
    const added = await addSources(db, creatorId, id, [{ type: b.type, id: b.id }], "available");
    track(db, "community_reply_used_in_studio", creatorId);
    return { added, workingSet: await workingSetView(db, id, studioSigner(db)) };
  },
  { feature: "community_to_studio_enabled", rateLimit: 60 },
);

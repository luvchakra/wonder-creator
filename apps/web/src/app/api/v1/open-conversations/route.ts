import { createConversation } from "@wonder/creator-community";
import { z } from "zod";
import { checkBudget, readJson, withApi } from "@/lib/api";

/**
 * POST /api/v1/open-conversations — start an Open Conversation (a sheet in Community). Limited conversations may name
 * people by @handle; only people the starter can see are added (never across a block). Spam-limited.
 */
export const POST = withApi(
  async ({ db, creatorId, req }) => {
    await checkBudget(`community:start:${creatorId}`, 20);
    const body = (await readJson(req, 20_000)) as Record<string, unknown>;
    const handles = z.array(z.string().trim().min(1).max(40)).max(20).optional().parse(body.inviteHandles) ?? [];
    let invite = z.array(z.string().uuid()).max(20).optional().parse(body.invite) ?? [];
    if (handles.length) {
      const { data } = await db.from("creators").select("id").in("handle", handles.map((h) => h.toLowerCase()));
      invite = [...new Set([...invite, ...(data ?? []).map((c) => c.id)])].filter((id) => id !== creatorId);
    }
    return { conversation: await createConversation(db, creatorId, { ...body, invite }) };
  },
  { feature: "open_conversations_enabled", rateLimit: 6 },
);

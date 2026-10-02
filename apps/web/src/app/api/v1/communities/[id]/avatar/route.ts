import { DomainError } from "@wonder/core";
import { setCommunityAvatar } from "@wonder/creator-community";
import { requireUuid, withApi } from "@/lib/api";
import { storeCommunityAvatar } from "@/lib/communities";

/** POST multipart `file` — the owner or a moderator sets the community's profile picture. */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    const pid = requireUuid(id, "community");
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) throw new DomainError("validation", "Choose a picture.");
    const objectId = await storeCommunityAvatar(creatorId, file);
    await setCommunityAvatar(db, pid, objectId);
    return { ok: true };
  },
  { feature: "communities_enabled", rateLimit: 20 },
);

/** DELETE — back to the painted monogram. */
export const DELETE = withApi<{ id: string }>(async ({ db }, { id }) => (await setCommunityAvatar(db, requireUuid(id, "community"), null), { ok: true }), { feature: "communities_enabled", rateLimit: 20 });

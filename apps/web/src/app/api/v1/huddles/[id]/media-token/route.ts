import { DomainError, must } from "@wonder/core";
import { selectMediaProvider } from "@wonder/creator-huddle/media";
import { requireUuid, withApi } from "@/lib/api";

/**
 * Short-lived, room-scoped media token — issued only to a creator who is currently JOINED
 * in a LIVE Huddle (verified via RLS-scoped reads). Media then flows client ↔ SFU directly.
 */
export const POST = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  const huddleId = requireUuid(id, "Huddle");
  // Authorization first, so non-participants learn nothing about the media setup.
  const me = await db.from("huddle_participants").select("status").eq("huddle_id", huddleId).eq("creator_id", creatorId).maybeSingle();
  const h = await db.from("huddles").select("status").eq("id", huddleId).maybeSingle();
  if (me.data?.status !== "joined" || h.data?.status !== "live") throw new DomainError("forbidden", "Join the Huddle first.");
  const provider = selectMediaProvider();
  if (!provider.configured) throw new DomainError("provider_unavailable", "Live audio and video aren't connected yet. Text chat works.");
  const creator = must(await db.from("creators").select("display_name").eq("id", creatorId).single());
  return provider.issueJoinToken({ huddleId, creatorId, displayName: creator.display_name || "Creator", canPublish: true });
}, { rateLimit: 20 });

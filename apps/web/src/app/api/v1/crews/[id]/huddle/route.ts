import { DomainError } from "@wonder/core";
import { startHuddle } from "@wonder/creator-huddle";
import { crewmates, getCrew, postCrewMessage } from "@wonder/creator-projects";
import { requireUuid, withApi } from "@/lib/api";

/** Start an invite-only Huddle with the rest of the crew (active members only). */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId }, { id }) => {
    const crewId = requireUuid(id, "crew");
    const crew = await getCrew(db, creatorId, crewId);
    if (!crew || crew.me?.status !== "active") throw new DomainError("not_found", "We couldn't find that crew.");
    const invite = await crewmates(db, crewId, creatorId);
    const huddleId = await startHuddle(db, { topic: crew.crew.name.slice(0, 140), discoverability: "invite_only", invite });
    // Handoff: the crew chat says where the conversation went.
    await postCrewMessage(db, creatorId, crewId, { body: "Started a Huddle — join from here.", huddleId }).catch(() => undefined);
    return { huddleId, invited: invite.length };
  },
  { rateLimit: 10 },
);

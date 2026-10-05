import { DomainError } from "@wonder/core";
import { attachSong, listParts, partWords, songAgreement, songOf } from "@wonder/creator-projects";
import { createArtifact, publishCreation, saveAudioTake } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

const schema = z.object({
  /** The mix as heard, rendered on the device and kept as the owner's recording. */
  materialId: z.string().uuid(),
  seconds: z.number().min(0).max(6 * 60 * 60),
  visibility: z.enum(["public", "unlisted"]).default("public"),
});

/**
 * Publish the song together (creative-room-parts.md, step 5b): the Room's owner, once everyone has agreed the credits.
 * The song is a Creation of the owner's — the mix as heard and the words — published on their page with the agreed
 * credits. The database refuses a publication whose credits aren't agreed or no longer hold.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    const projectId = requireUuid(id, "Room");
    const input = schema.parse(await readJson(req, 5_000));
    const { data: room } = await db.from("projects").select("id, title, creator_id").eq("id", projectId).maybeSingle();
    if (!room) throw new DomainError("not_found", "That Creative Room isn't here.");
    if (room.creator_id !== creatorId) throw new DomainError("forbidden", "Only the Room's owner publishes its song.");
    const agreement = await songAgreement(db, projectId);
    if (!agreement || agreement.status !== "agreed" || !agreement.holds) throw new DomainError("validation", "Everyone on the work signs off on the credits first.");
    let songId = await songOf(db, projectId);
    if (!songId) {
      const a = await createArtifact(db, creatorId, { artifactType: "song_concept", title: room.title, content: "", authorKind: "creator", provenance: { origin: "typed", details: { song: projectId } } });
      await attachSong(db, projectId, a.id);
      songId = a.id;
    }
    // The words travel with it: the writing part as agreed.
    const parts = await listParts(db, projectId, creatorId);
    const writing = parts.find((p) => p.kind === "writing" && p.artifactId);
    const words = writing ? ((await partWords(db, writing.id).catch(() => null))?.current.content ?? "") : "";
    await saveAudioTake(db, creatorId, songId, { materialId: input.materialId, seconds: input.seconds, content: words });
    const pub = await publishCreation(db, creatorId, songId, { visibility: input.visibility });
    const { data: me } = await db.from("creators").select("handle").eq("id", creatorId).maybeSingle();
    return { artifactId: songId, url: me?.handle ? `/p/${me.handle}/${pub.slug}` : null };
  },
  { rateLimit: 10 },
);

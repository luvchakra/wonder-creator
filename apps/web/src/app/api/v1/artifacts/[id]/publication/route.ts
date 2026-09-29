import { publicationFor, publicationStats, publishCreation, unpublishCreation, updatePublishedWork } from "@wonder/creator-studio";
import { mediaLink } from "@wonder/core/server";
import { readJson, requireUuid, withApi } from "@/lib/api";

/**
 * CreatorPublish for one Creation (docs/creator-publish.md).
 * GET — its publication (address, visibility, current revision, changes since publishing) and what could be published.
 * POST — publish, or update the published version: a new frozen revision under the same address.
 * PATCH — placement and presentation only (visibility, featured, address, context and rights toggles).
 * DELETE — unpublish (the address stops working; revisions are kept).
 */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => {
  const r = await publicationFor(db, requireUuid(id, "Creation"));
  const { data: me } = await db.from("artifacts").select("creators!artifacts_creator_id_fkey(handle)").eq("id", id).maybeSingle();
  return {
    ...r,
    handle: (me?.creators as unknown as { handle: string | null } | null)?.handle ?? null,
    covers: r.coverCandidates.map((objectId) => ({ objectId, url: mediaLink(objectId) })).filter((c) => c.url),
    stats: r.publication ? await publicationStats(db, r.publication.workId) : null,
  };
});

export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ publication: await publishCreation(db, creatorId, requireUuid(id, "Creation"), await readJson(req)) }), { rateLimit: 20 });

export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => ({ publication: await updatePublishedWork(db, requireUuid(id, "Creation"), await readJson(req)) }), { rateLimit: 60 });

export const DELETE = withApi<{ id: string }>(async ({ db }, { id }) => {
  await unpublishCreation(db, requireUuid(id, "Creation"));
  return { ok: true };
});

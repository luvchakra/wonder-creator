import { listPublications, preparePublications } from "@wonder/creator-studio";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** A piece's publications (drafts, scheduled, published, failed) with their attempts. */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => ({ publications: await listPublications(db, requireUuid(id, "piece")) }));

/** Prepare drafts, one per destination. Nothing is published until the creator approves. */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ publications: await preparePublications(db, creatorId, requireUuid(id, "piece"), await readJson(req)) }), { rateLimit: 30 });

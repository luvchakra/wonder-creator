import { addArtifactComment } from "@wonder/creator-studio";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Comment on a piece (owner and collaborators), optionally on a version and a quoted passage. */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ id: await addArtifactComment(db, creatorId, requireUuid(id, "Creation"), await readJson(req, 20_000)) }), { rateLimit: 60 });

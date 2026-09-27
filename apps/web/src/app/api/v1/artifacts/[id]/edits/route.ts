import { collaboratorSave } from "@wonder/creator-studio";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** A collaborator with edit access saves a new version, credited to them (refused if a newer version exists). */
export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => ({ version: await collaboratorSave(db, requireUuid(id, "Creation"), await readJson(req, 2_000_000)) }), { rateLimit: 30 });

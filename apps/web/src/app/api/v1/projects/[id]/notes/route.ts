import { addMixNote } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Leave a note at a moment of the song (Listen together) — the people making the work; the database decides. */
export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => ({ id: await addMixNote(db, requireUuid(id, "Room"), await readJson(req, 10_000)) }));

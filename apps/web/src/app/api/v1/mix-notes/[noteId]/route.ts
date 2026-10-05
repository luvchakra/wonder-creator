import { deleteMixNote, resolveMixNote } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

const schema = z.object({ resolved: z.boolean() });

/** Resolve a note, or open it again — its author or the Room's owner/admins. */
export const PATCH = withApi<{ noteId: string }>(async ({ db, req }, { noteId }) => {
  const { resolved } = schema.parse(await readJson(req, 1_000));
  await resolveMixNote(db, requireUuid(noteId, "Note"), resolved);
  return { ok: true };
});

/** Delete a note — its author or the Room's owner/admins. */
export const DELETE = withApi<{ noteId: string }>(async ({ db }, { noteId }) => {
  await deleteMixNote(db, requireUuid(noteId, "Note"));
  return { ok: true };
});

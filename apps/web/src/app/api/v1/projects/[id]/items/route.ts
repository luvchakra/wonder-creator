import { linkToProject, setProjectItemNote, unlinkFromProject } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

const item = z.object({ itemId: z.string().uuid() });
const note = item.extend({ note: z.string().max(500).nullable() });

/** Adds links ({ kind, ids }). Only the creator's own work (and Huddles they were part of) can be added. */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ ok: true, added: await linkToProject(db, creatorId, requireUuid(id, "project"), await readJson(req)) }));

export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const b = note.parse(await readJson(req));
  await setProjectItemNote(db, requireUuid(id, "project"), b.itemId, b.note);
  return { ok: true };
});

/** Removes the link only; the work itself is kept. */
export const DELETE = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  await unlinkFromProject(db, requireUuid(id, "project"), item.parse(await readJson(req)).itemId);
  return { ok: true };
});

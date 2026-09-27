import { linkToProject, setItemShared, setProjectItemNote, unlinkFromProject } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

const item = z.object({ itemId: z.string().uuid() });
const patch = item.extend({ note: z.string().max(500).nullable().optional(), shared: z.boolean().optional() });

/** Adds links ({ kind, ids, shared }). Only your own work (and Huddles you were part of); crew members add their own work, shared. */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ ok: true, added: await linkToProject(db, creatorId, requireUuid(id, "Creative Room"), await readJson(req)) }));

/** A link's note, or (for the owner of the work) whether it's shared with the crew. */
export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const b = patch.parse(await readJson(req));
  const projectId = requireUuid(id, "Creative Room");
  if (b.note !== undefined) await setProjectItemNote(db, projectId, b.itemId, b.note);
  if (b.shared !== undefined) await setItemShared(db, projectId, b.itemId, b.shared);
  return { ok: true };
});

/** Removes the link only; the work itself is kept. */
export const DELETE = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  await unlinkFromProject(db, requireUuid(id, "Creative Room"), item.parse(await readJson(req)).itemId);
  return { ok: true };
});

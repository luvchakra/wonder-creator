import { archiveConversation, getConversation, renameConversation } from "@wonder/creator-talk";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const GET = withApi<{ id: string }>(async ({ db }, { id }) => getConversation(db, requireUuid(id, "conversation")));

export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const { title } = z.object({ title: z.string() }).parse(await readJson(req));
  await renameConversation(db, requireUuid(id, "conversation"), title);
  return { ok: true };
});

export const DELETE = withApi<{ id: string }>(async ({ db }, { id }) => {
  await archiveConversation(db, requireUuid(id, "conversation"));
  return { ok: true };
});

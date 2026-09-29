import { setMuted } from "@wonder/creator-community";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** POST `{on}` — mute (or unmute) someone in your Community. Private; they aren't told. */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  const { on } = (await readJson(req)) as { on?: boolean };
  await setMuted(db, creatorId, requireUuid(id, "creator"), on !== false);
  return { ok: true };
});

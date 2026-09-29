import { setConversationClosed } from "@wonder/creator-community";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** POST `{closed}` — owner closes (no new replies, all still readable) or reopens. */
export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const { closed } = (await readJson(req)) as { closed?: boolean };
  return { conversation: await setConversationClosed(db, requireUuid(id, "conversation"), closed !== false) };
});

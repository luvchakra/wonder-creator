import { enterHuddle } from "@wonder/creator-huddle";
import { requireUuid, withApi } from "@/lib/api";

export const POST = withApi<{ id: string }>(async ({ db }, { id }) => {
  await enterHuddle(db, requireUuid(id, "Huddle"));
  return { ok: true };
});

import { SOURCE_STATES, setSourceStates, workingSetView } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { assertUuid, studioSigner } from "@/lib/studio";

/** POST /api/v1/studio-sessions/:id/states — several sources at once ("Use this connection", "use these two photos"). */
export const POST = withApi<{ id: string }>(
  async ({ db, req }, { id }) => {
    assertUuid(id);
    const b = z.object({ ids: z.array(z.string().uuid()).min(1).max(50), state: z.enum(SOURCE_STATES) }).parse(await readJson(req));
    await setSourceStates(db, id, b.ids, b.state);
    return { workingSet: await workingSetView(db, id, studioSigner(db)) };
  },
  { rateLimit: 120 },
);

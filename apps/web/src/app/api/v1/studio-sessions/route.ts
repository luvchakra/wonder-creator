import { openStudioSession, workingSetView } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { studioSigner } from "@/lib/studio";

/** POST /api/v1/studio-sessions — open (or resume) the creator's CreativeStudio session for a Creation, with its Working Set. */
export const POST = withApi(
  async ({ db, creatorId, req }) => {
    const { artifactId } = z.object({ artifactId: z.string().uuid() }).parse(await readJson(req));
    const s = await openStudioSession(db, creatorId, artifactId);
    return { workingSet: await workingSetView(db, s.id, studioSigner(db)) };
  },
  { rateLimit: 60 },
);

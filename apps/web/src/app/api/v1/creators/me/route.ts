import { getAutonomy, getBoundaries, getIdentity, getVoice, saveProfileSettings } from "@wonder/creator-identity";
import { readJson, withApi } from "@/lib/api";

export const GET = withApi(async ({ db, creatorId }) => {
  const [identity, voice, boundaries, autonomy] = await Promise.all([getIdentity(db, creatorId), getVoice(db, creatorId), getBoundaries(db, creatorId), getAutonomy(db, creatorId)]);
  return { identity, voice, boundaries, autonomy };
});

export const PATCH = withApi(async ({ db, creatorId, req }) => {
  await saveProfileSettings(db, creatorId, await readJson(req));
  return { ok: true };
});

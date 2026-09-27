import { readJson, withApi } from "@/lib/api";
import { providerSchema, removeKey, updatePreferences } from "@/lib/byok";

/** Default model and whether CreatorBrain uses this key. */
export const PATCH = withApi<{ provider: string }>(async ({ creatorId, req }, { provider }) => ({ key: await updatePreferences(creatorId, providerSchema.parse(provider), await readJson(req)) }), { rateLimit: 30 });

/** Remove the key: the secret is deleted, and CreatorBrain goes back to the platform provider. */
export const DELETE = withApi<{ provider: string }>(async ({ creatorId }, { provider }) => {
  await removeKey(creatorId, providerSchema.parse(provider));
  return { ok: true };
}, { rateLimit: 10 });

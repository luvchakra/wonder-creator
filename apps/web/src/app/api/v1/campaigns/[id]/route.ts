import { DomainError } from "@wonder/core";
import { getCampaign, updateCampaign } from "@wonder/creator-projects";
import { readJson, withApi } from "@/lib/api";

const uuid = (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("not_found", "That campaign isn't available.");
  return id;
};
export const GET = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  const c = await getCampaign(db, creatorId, uuid(id));
  if (!c) throw new DomainError("not_found", "That campaign isn't available.");
  return c;
});
export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => ({ campaign: await updateCampaign(db, uuid(id), await readJson(req)) }), { rateLimit: 30 });

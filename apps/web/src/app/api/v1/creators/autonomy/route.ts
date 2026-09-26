import { AUTONOMY_DOMAINS, getAutonomy, resetAutonomy, setAutonomy } from "@wonder/creator-identity";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";

const schema = z.object({
  domain: z.enum(AUTONOMY_DOMAINS.map((d) => d.domain) as [string, ...string[]]),
  level: z.enum(["never", "observe", "suggest", "draft", "execute_with_approval", "auto_execute"]),
});

export const GET = withApi(async ({ db, creatorId }) => getAutonomy(db, creatorId));

export const PATCH = withApi(async ({ db, creatorId, req }) => {
  const body = (await readJson(req)) as { reset?: boolean };
  if (body.reset) {
    await resetAutonomy(db, creatorId);
    return getAutonomy(db, creatorId);
  }
  const { domain, level } = schema.parse(body);
  await setAutonomy(db, creatorId, domain as never, level);
  return getAutonomy(db, creatorId);
});

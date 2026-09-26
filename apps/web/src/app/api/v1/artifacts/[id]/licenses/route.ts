import { addLicense } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { requirePassword } from "@/lib/step-up";

/** Recording a draft is free; granting an active commercial license needs the creator's password (step-up). */
export const POST = withApi<{ id: string }>(async ({ db, userId, creatorId, req }, { id }) => {
  const body = await readJson(req);
  const { licenseType, status, password } = z.object({ licenseType: z.string().optional(), status: z.string().optional(), password: z.string().optional() }).parse(body);
  if (licenseType === "commercial" && status && status !== "draft") await requirePassword(db, userId, password, "grant a commercial license");
  return { license: await addLicense(db, creatorId, requireUuid(id, "piece"), body) };
});

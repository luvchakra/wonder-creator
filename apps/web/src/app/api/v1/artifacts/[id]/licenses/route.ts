import { addLicense, isConsequential, licenseSchema } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { requirePassword } from "@/lib/step-up";

/**
 * Recording a draft is free; granting an active license with consequential terms (commercial, paid,
 * limited edition or exclusive) needs the creator's password (step-up).
 */
export const POST = withApi<{ id: string }>(async ({ db, userId, creatorId, req }, { id }) => {
  const body = await readJson(req);
  const { password } = z.object({ password: z.string().optional() }).passthrough().parse(body);
  const license = licenseSchema.parse(body);
  if (license.status === "active" && isConsequential(license)) await requirePassword(db, userId, password, "grant this license");
  return { license: await addLicense(db, creatorId, requireUuid(id, "Creation"), body) };
});

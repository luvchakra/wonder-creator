import { setLicenseStatus } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const { status } = z.object({ status: z.enum(["active", "revoked"]) }).parse(await readJson(req));
  await setLicenseStatus(db, requireUuid(id, "license"), status);
  return { ok: true };
});

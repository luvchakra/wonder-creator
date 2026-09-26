import { DomainError } from "@wonder/core";
import { setLicenseStatus } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { requirePassword } from "@/lib/step-up";

/** Activating a commercial license grants rights, so it needs the creator's password (step-up). */
export const PATCH = withApi<{ id: string }>(async ({ db, userId, req }, { id }) => {
  const licenseId = requireUuid(id, "license");
  const { status, password } = z.object({ status: z.enum(["active", "revoked"]), password: z.string().optional() }).parse(await readJson(req));
  if (status === "active") {
    const lic = await db.from("licenses").select("license_type").eq("id", licenseId).maybeSingle();
    if (!lic.data) throw new DomainError("not_found", "We couldn't find that license.");
    if (lic.data.license_type === "commercial") await requirePassword(db, userId, password, "activate a commercial license");
  }
  await setLicenseStatus(db, licenseId, status);
  return { ok: true };
});

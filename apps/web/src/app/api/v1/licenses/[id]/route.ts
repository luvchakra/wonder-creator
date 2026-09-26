import { DomainError } from "@wonder/core";
import { isConsequential, setLicenseStatus } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { requirePassword } from "@/lib/step-up";

/** Activating a license with consequential terms grants rights, so it needs the creator's password (step-up). */
export const PATCH = withApi<{ id: string }>(async ({ db, userId, req }, { id }) => {
  const licenseId = requireUuid(id, "license");
  const { status, password } = z.object({ status: z.enum(["active", "revoked"]), password: z.string().optional() }).parse(await readJson(req));
  if (status === "active") {
    const lic = await db.from("licenses").select("license_type, mode").eq("id", licenseId).maybeSingle();
    if (!lic.data) throw new DomainError("not_found", "We couldn't find that license.");
    if (isConsequential({ licenseType: lic.data.license_type as "commercial", mode: lic.data.mode as "free" })) await requirePassword(db, userId, password, "activate this license");
  }
  await setLicenseStatus(db, licenseId, status);
  return { ok: true };
});

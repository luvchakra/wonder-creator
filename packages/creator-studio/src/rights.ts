import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";

export const LICENSE_TYPES = [
  { value: "personal", label: "Personal Use", note: "For personal viewing" },
  { value: "educational", label: "Educational Use", note: "For non-commercial education" },
  { value: "editorial", label: "Editorial Use", note: "For media and press" },
  { value: "promotional", label: "Promotional Use", note: "To promote the work or creator" },
  { value: "internal", label: "Internal Use", note: "Within one organisation" },
  { value: "commercial", label: "Commercial License", note: "For brand and commercial use" },
] as const;

export const RIGHTS_DISCLAIMER =
  "Wonder Creator keeps a record of ownership, licenses and changes as evidence. A record here is not, on its own, legal proof of ownership in every jurisdiction.";

export const rightsSchema = z.object({
  ownershipKind: z.enum(["sole", "joint", "transferred"]),
  copyrightHolder: z.string().trim().min(1).max(200),
  copyrightRegistration: z.string().trim().max(200).optional().nullable(),
  attributionRequired: z.boolean(),
  derivativesAllowed: z.boolean(),
  notes: z.string().trim().max(2000).optional().nullable(),
  owners: z
    .array(z.object({ name: z.string().trim().min(1).max(200), creatorId: z.string().uuid().nullable().optional(), sharePercent: z.number().gt(0).lte(100) }))
    .min(1)
    .max(10),
});

export const licenseSchema = z
  .object({
    licenseType: z.enum(["personal", "commercial", "editorial", "promotional", "educational", "internal"]),
    licenseeName: z.string().trim().max(200).optional().nullable(),
    exclusive: z.boolean().default(false),
    territory: z.string().trim().min(1).max(120).default("Worldwide"),
    startsOn: z.string().date().optional().nullable(),
    endsOn: z.string().date().optional().nullable(),
    modificationAllowed: z.boolean().default(false),
    derivativesAllowed: z.boolean().default(false),
    resaleAllowed: z.boolean().default(false),
    attributionRequired: z.boolean().default(true),
    status: z.enum(["draft", "active", "revoked"]).default("draft"),
  })
  .refine((l) => !l.startsOn || !l.endsOn || l.endsOn >= l.startsOn, { message: "The end date must be after the start date.", path: ["endsOn"] });

/** Ownership shares must add up to exactly 100%, and joint ownership needs at least two owners. */
export function validateOwnership(input: z.infer<typeof rightsSchema>): string | null {
  const total = Math.round(input.owners.reduce((s, o) => s + o.sharePercent, 0) * 100) / 100;
  if (total !== 100) return `Ownership shares add up to ${total}%. They need to total 100%.`;
  if (input.ownershipKind === "sole" && input.owners.length !== 1) return "Sole ownership has exactly one owner.";
  if (input.ownershipKind === "joint" && input.owners.length < 2) return "Joint ownership needs at least two owners.";
  return null;
}

export async function getRights(db: Db, artifactId: string) {
  const rights = await db.from("rights_records").select("*, rights_owners(*), licenses(*)").eq("artifact_id", artifactId).maybeSingle();
  if (rights.error) throw fromDbError(rights.error);
  if (!rights.data) return null;
  const events = await db.from("rights_events").select("id, event, created_at").eq("rights_id", rights.data.id).order("created_at", { ascending: false }).limit(30);
  return { ...rights.data, events: events.data ?? [] };
}

export async function saveRights(db: Db, creatorId: string, artifactId: string, raw: unknown) {
  const input = rightsSchema.parse(raw);
  const problem = validateOwnership(input);
  if (problem) throw new DomainError("validation", problem);
  const rec = must(await db.from("rights_records").select("id").eq("artifact_id", artifactId).maybeSingle(), "We couldn't find the rights record.");
  const up = await db
    .from("rights_records")
    .update({
      ownership_kind: input.ownershipKind,
      copyright_holder: input.copyrightHolder,
      copyright_registration: input.copyrightRegistration || null,
      attribution_required: input.attributionRequired,
      derivatives_allowed: input.derivativesAllowed,
      notes: input.notes || null,
    })
    .eq("id", rec.id);
  if (up.error) throw fromDbError(up.error);
  const del = await db.from("rights_owners").delete().eq("rights_id", rec.id);
  if (del.error) throw fromDbError(del.error);
  const ins = await db.from("rights_owners").insert(
    input.owners.map((o) => ({ rights_id: rec.id, creator_id: creatorId, owner_creator_id: o.creatorId ?? null, owner_name: o.name, share_percent: o.sharePercent })),
  );
  if (ins.error) throw fromDbError(ins.error);
}

export async function addLicense(db: Db, creatorId: string, artifactId: string, raw: unknown) {
  const l = licenseSchema.parse(raw);
  const rec = must(await db.from("rights_records").select("id").eq("artifact_id", artifactId).maybeSingle(), "We couldn't find the rights record.");
  return must(
    await db
      .from("licenses")
      .insert({
        rights_id: rec.id,
        creator_id: creatorId,
        license_type: l.licenseType,
        licensee_name: l.licenseeName || null,
        exclusive: l.exclusive,
        territory: l.territory,
        starts_on: l.startsOn || null,
        ends_on: l.endsOn || null,
        modification_allowed: l.modificationAllowed,
        derivatives_allowed: l.derivativesAllowed,
        resale_allowed: l.resaleAllowed,
        attribution_required: l.attributionRequired,
        status: l.status,
      })
      .select("*")
      .single(),
  );
}

export async function setLicenseStatus(db: Db, licenseId: string, status: "active" | "revoked") {
  const res = await db.from("licenses").update({ status }).eq("id", licenseId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that license.");
}

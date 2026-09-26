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
  "Wonder Creator keeps a record of ownership, licenses and changes as evidence. These records don't by themselves establish legal ownership; legal effect depends on your agreements and the law where you are.";

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
  // Owners only (RLS); others see the current record, not its history.
  const events = await db.from("rights_events").select("id, event, details, created_at").eq("rights_id", rights.data.id).order("created_at", { ascending: false }).limit(200);
  return { ...rights.data, events: (events.data ?? []).map((e) => ({ id: e.id, event: e.event, created_at: e.created_at, ...describeRightsEvent(e.event, (e.details ?? {}) as Record<string, unknown>) })) };
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

const OWNERSHIP_LABEL: Record<string, string> = { sole: "sole ownership", joint: "joint ownership", transferred: "transferred ownership" };
const PRIVACY_LABEL: Record<string, string> = { creator_private: "private", public: "public", followers: "followers", unlisted: "unlisted", collaborators: "collaborators", huddle: "Huddle" };
const licenseName = (d: Record<string, unknown>) => {
  const type = LICENSE_TYPES.find((t) => t.value === d.license_type)?.label ?? "License";
  return d.licensee ? `${type} for ${String(d.licensee)}` : type;
};

/** A rights event as a plain sentence for the history feed. Unknown events stay readable. */
export function describeRightsEvent(event: string, d: Record<string, unknown>): { title: string; kind: "rights" | "license" | "publication" | "derivative"; derivativeId?: string } {
  switch (event) {
    case "rights.created":
      return { title: `Rights record created — ${String(d.copyright_holder ?? "you")}, ${OWNERSHIP_LABEL[String(d.ownership_kind)] ?? "sole ownership"}`, kind: "rights" };
    case "ownership.updated":
      return { title: `Ownership changed from ${OWNERSHIP_LABEL[String(d.from)] ?? d.from} to ${OWNERSHIP_LABEL[String(d.to)] ?? d.to}`, kind: "rights" };
    case "copyright.updated":
      return { title: `Copyright holder set to ${String(d.holder)}${d.registration ? ` (registration ${String(d.registration)})` : ""}`, kind: "rights" };
    case "attribution.changed":
      return { title: d.required ? "Attribution is now required" : "Attribution is no longer required", kind: "rights" };
    case "derivatives.changed":
      return { title: d.allowed ? "Others may now make derivatives" : "Others may no longer make derivatives", kind: "rights" };
    case "notes.updated":
      return { title: "Rights notes updated", kind: "rights" };
    case "owner.added":
      return { title: `Owner added: ${String(d.name)} (${Number(d.share_percent)}%)`, kind: "rights" };
    case "owner.removed":
      return { title: `Owner removed: ${String(d.name)} (${Number(d.share_percent)}%)`, kind: "rights" };
    case "owner.updated":
      return { title: `Owner updated: ${String(d.name)} (${Number(d.share_percent)}%)`, kind: "rights" };
    case "license.created":
      return { title: `${licenseName(d)} recorded (${String(d.status ?? "draft")})`, kind: "license" };
    case "license.activated":
      return { title: `${licenseName(d)} activated`, kind: "license" };
    case "license.revoked":
      return { title: `${licenseName(d)} revoked`, kind: "license" };
    case "license.expired":
      return { title: `${licenseName(d)} expired`, kind: "license" };
    case "license.deleted":
      return { title: `${licenseName(d)} removed`, kind: "license" };
    case "license.updated":
      return { title: `${licenseName(d)} updated`, kind: "license" };
    case "publication.changed": {
      const parts: string[] = [];
      if (d.privacy_from !== d.privacy_to) parts.push(`visibility ${PRIVACY_LABEL[String(d.privacy_from)] ?? d.privacy_from} → ${PRIVACY_LABEL[String(d.privacy_to)] ?? d.privacy_to}`);
      if (d.status_from !== d.status_to) parts.push(d.status_to === "published" ? "published" : `status ${String(d.status_from).replace("_", " ")} → ${String(d.status_to).replace("_", " ")}`);
      return { title: `Sharing changed: ${parts.join(", ") || "updated"}`, kind: "publication" };
    }
    case "derivative.created":
      return { title: d.by_self ? "You made a derivative of this piece" : "Another creator made a derivative of this piece (with your permission)", kind: "derivative", derivativeId: d.by_self ? String(d.derivative_id) : undefined };
    default:
      // Events recorded before semantic history ("rights_records.update" etc.).
      return { title: `Rights record changed (${event.replace(/_/g, " ").replace(".", " · ")})`, kind: event.startsWith("licenses") ? "license" : "rights" };
  }
}

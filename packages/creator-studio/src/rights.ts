import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db, Json, Tables } from "@wonder/db";
import { z } from "zod";
import { describeTerms, isConsequential, LICENSE_MODES, licenseTermsFields, licenseTermsSchema, termsFromRecord, termsToRecord, withTermsChecks, type LicenseTerms } from "./licensing";

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

/** A license the creator records directly: its terms plus who it's for and whether it's active yet. */
export const licenseSchema = withTermsChecks(
  licenseTermsFields.extend({
    licenseeName: z.string().trim().max(200).optional().nullable(),
    permittedUse: z.string().trim().max(1000).optional().nullable(),
    status: z.enum(["draft", "active", "revoked"]).default("draft"),
  }),
);

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
        ...(termsToRecord(l) as { license_type: string }),
        licensee_name: l.licenseeName || null,
        permitted_use: l.permittedUse || null,
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

const requestLabel = (d: Record<string, unknown>) => {
  const use = LICENSE_TYPES.find((t) => t.value === d.license_type)?.label ?? "license";
  const mode = LICENSE_MODES.find((m) => m.value === d.mode)?.label;
  return mode ? `${use}, ${mode.toLowerCase()}` : use;
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
    case "license.requested":
      return { title: `${String(d.requester ?? "A creator")} requested a ${requestLabel(d)}`, kind: "license" };
    case "license.request_approved":
      return { title: `License request from ${String(d.requester ?? "a creator")} approved (${requestLabel(d)})`, kind: "license" };
    case "license.request_declined":
      return { title: `License request from ${String(d.requester ?? "a creator")} declined`, kind: "license" };
    case "license.request_countered":
      return { title: `Counter-offer sent to ${String(d.requester ?? "a creator")} (${requestLabel(d)})`, kind: "license" };
    case "license.request_withdrawn":
      return { title: `${String(d.requester ?? "A creator")} withdrew their license request`, kind: "license" };
    case "publication.changed": {
      const parts: string[] = [];
      if (d.privacy_from !== d.privacy_to) parts.push(`visibility ${PRIVACY_LABEL[String(d.privacy_from)] ?? d.privacy_from} → ${PRIVACY_LABEL[String(d.privacy_to)] ?? d.privacy_to}`);
      if (d.status_from !== d.status_to) parts.push(d.status_to === "published" ? "published" : `status ${String(d.status_from).replace("_", " ")} → ${String(d.status_to).replace("_", " ")}`);
      return { title: `Sharing changed: ${parts.join(", ") || "updated"}`, kind: "publication" };
    }
    case "derivative.created":
      return { title: d.by_self ? "You made a derivative of this Creation" : "Another creator made a derivative of this Creation (with your permission)", kind: "derivative", derivativeId: d.by_self ? String(d.derivative_id) : undefined };
    default:
      // Events recorded before semantic history ("rights_records.update" etc.).
      return { title: `Rights record changed (${event.replace(/_/g, " ").replace(".", " · ")})`, kind: event.startsWith("licenses") ? "license" : "rights" };
  }
}

// ---------------------------------------------------------------------------
// License requests (P0.1-08)
// ---------------------------------------------------------------------------
export const licenseRequestSchema = z.object({ proposedUse: z.string().trim().min(1, "Say how you'd like to use it.").max(2000), terms: licenseTermsSchema });

/** Ask the owner of a piece you can see for a license. RLS checks you can read it and don't own it. */
export async function requestLicense(db: Db, creatorId: string, artifactId: string, raw: unknown) {
  const input = licenseRequestSchema.parse(raw);
  const art = must(await db.from("artifacts").select("id, creator_id").eq("id", artifactId).maybeSingle(), "We couldn't find that Creation.");
  if (art.creator_id === creatorId) throw new DomainError("validation", "This is your own Creation — add a license from its Rights tab instead.");
  const res = await db
    .from("license_requests")
    .insert({ artifact_id: artifactId, owner_creator_id: art.creator_id, requester_creator_id: creatorId, proposed_use: input.proposedUse, terms: termsToRecord(input.terms) as NonNullable<Json> })
    .select("*")
    .single();
  if (res.error?.code === "23505") throw new DomainError("conflict", "You already have an open request for this Creation.");
  return must(res);
}

export interface LicenseRequestView {
  id: string;
  artifactId: string;
  status: "pending" | "approved" | "declined" | "countered" | "withdrawn";
  proposedUse: string;
  terms: LicenseTerms;
  counterTerms: LicenseTerms | null;
  summary: string[];
  counterSummary: string[] | null;
  consequential: boolean;
  counterConsequential: boolean;
  responseNote: string | null;
  licenseId: string | null;
  requester: { id: string; name: string; handle: string | null };
  createdAt: string;
  respondedAt: string | null;
}

function toView(r: Tables<"license_requests"> & { creators?: unknown }): LicenseRequestView {
  const terms = termsFromRecord(r.terms as Record<string, unknown>);
  const counter = r.counter_terms ? termsFromRecord(r.counter_terms as Record<string, unknown>) : null;
  const who = (r.creators as { id: string; display_name: string; handle: string | null } | null) ?? null;
  return {
    id: r.id,
    artifactId: r.artifact_id,
    status: r.status as LicenseRequestView["status"],
    proposedUse: r.proposed_use,
    terms,
    counterTerms: counter,
    summary: describeTerms(terms),
    counterSummary: counter ? describeTerms(counter) : null,
    consequential: isConsequential(terms),
    counterConsequential: counter ? isConsequential(counter) : false,
    responseNote: r.response_note,
    licenseId: r.license_id,
    requester: { id: r.requester_creator_id, name: who?.display_name ?? "A creator", handle: who?.handle ?? null },
    createdAt: r.created_at,
    respondedAt: r.responded_at,
  };
}

/** Requests for a piece: all of them for its owner, only your own for anyone else (RLS). */
export async function listLicenseRequests(db: Db, artifactId: string): Promise<LicenseRequestView[]> {
  const { data, error } = await db
    .from("license_requests")
    .select("*, creators!license_requests_requester_creator_id_fkey(id, display_name, handle)")
    .eq("artifact_id", artifactId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw fromDbError(error);
  return (data ?? []).map(toView);
}

export async function getLicenseRequest(db: Db, id: string): Promise<LicenseRequestView> {
  return toView(must(await db.from("license_requests").select("*, creators!license_requests_requester_creator_id_fkey(id, display_name, handle)").eq("id", id).maybeSingle(), "We couldn't find that request."));
}

function requestError(e: { code?: string; message?: string }): DomainError {
  if (e.code === "P0002") return new DomainError("not_found", "We couldn't find that request.");
  if (e.code === "55000") return new DomainError("conflict", e.message ?? "This request has already been answered.");
  return fromDbError(e);
}

/** Owner: approve (creates an active license), decline, or counter with different terms. */
export async function respondToLicenseRequest(db: Db, id: string, input: { decision: "approve" | "decline" | "counter"; note?: string | null; counter?: LicenseTerms | null }) {
  const { data, error } = await db.rpc("respond_license_request", {
    p_request: id,
    p_decision: input.decision,
    p_note: input.note || undefined,
    p_counter: input.decision === "counter" && input.counter ? (termsToRecord(input.counter) as Json) : undefined,
  });
  if (error) throw requestError(error);
  return data;
}

/** Requester: accept a counter-offer (creates an active license) or withdraw. */
export async function actOnLicenseRequest(db: Db, id: string, action: "accept_counter" | "withdraw") {
  const { data, error } = await db.rpc("act_on_license_request", { p_request: id, p_action: action });
  if (error) throw requestError(error);
  return data;
}

import { z } from "zod";

/**
 * License terms (P0.1-08). Client-safe: shared by the creator's license flow, license requests and
 * counter-offers. Fees are terms on record; Wonder Creator doesn't take payments here.
 */

// The plain vocabulary lives in licensing-options (no zod): the browser reads it on every Creation page.
export * from "./licensing-options";
import { LICENSE_MODES, LICENSE_USES, USAGE_CHANNELS, channelLabels, type UsageChannel } from "./licensing-options";

const CHANNEL_VALUES = USAGE_CHANNELS.map((c) => c.value) as [UsageChannel, ...UsageChannel[]];
export const usageChannelsSchema = z
  .array(z.enum(CHANNEL_VALUES))
  .max(10)
  .default([])
  .transform((c) => [...new Set(c)]);

const date = z.string().date().or(z.literal("")).nullish().transform((v) => v || null);

/** The terms' fields, without cross-field checks (extend it, then apply `withTermsChecks`). */
export const licenseTermsFields = z.object({
  licenseType: z.enum(["personal", "commercial", "editorial", "promotional", "educational", "internal"]),
  mode: z.enum(["free", "free_license", "paid_nonexclusive", "limited_edition", "exclusive"]).default("free_license"),
  territory: z.string().trim().min(1).max(120).default("Worldwide"),
  startsOn: date,
  endsOn: date,
  modificationAllowed: z.boolean().default(false),
  derivativesAllowed: z.boolean().default(false),
  resaleAllowed: z.boolean().default(false),
  attributionRequired: z.boolean().default(true),
  feeAmount: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  feeCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, like INR or USD.").optional().nullable(),
  editionSize: z.coerce.number().int().min(1).max(100_000).optional().nullable(),
  usageChannels: usageChannelsSchema,
});

type TermsShape = z.infer<typeof licenseTermsFields>;
export function withTermsChecks<T extends z.ZodType<TermsShape>>(schema: T) {
  return schema
    .refine((t) => !t.startsOn || !t.endsOn || t.endsOn >= t.startsOn, { message: "The end date must be after the start date.", path: ["endsOn"] })
    .refine((t) => t.mode !== "paid_nonexclusive" || (t.feeAmount != null && !!t.feeCurrency), { message: "A paid license needs a fee and currency.", path: ["feeAmount"] })
    .refine((t) => t.mode !== "limited_edition" || t.editionSize != null, { message: "Say how many licenses are in the edition.", path: ["editionSize"] });
}

export const licenseTermsSchema = withTermsChecks(licenseTermsFields);
export type LicenseTerms = z.infer<typeof licenseTermsSchema>;

/** Terms that grant money-bearing, exclusive or commercial rights: they need the creator's explicit, stepped-up approval. */
export function isConsequential(t: Pick<LicenseTerms, "licenseType" | "mode">): boolean {
  return t.licenseType === "commercial" || t.mode === "paid_nonexclusive" || t.mode === "limited_edition" || t.mode === "exclusive";
}

/** The terms as stored in license requests (snake_case, matching the database). */
export function termsToRecord(t: LicenseTerms): Record<string, unknown> {
  return {
    license_type: t.licenseType,
    mode: t.mode,
    exclusive: t.mode === "exclusive",
    territory: t.territory,
    starts_on: t.startsOn ?? null,
    ends_on: t.endsOn ?? null,
    modification_allowed: t.modificationAllowed,
    derivatives_allowed: t.derivativesAllowed,
    resale_allowed: t.resaleAllowed,
    attribution_required: t.attributionRequired,
    fee_amount: t.mode === "paid_nonexclusive" || t.mode === "exclusive" || t.mode === "limited_edition" ? (t.feeAmount ?? null) : null,
    fee_currency: t.feeAmount != null ? (t.feeCurrency ?? null) : null,
    edition_size: t.mode === "limited_edition" ? (t.editionSize ?? null) : null,
    usage_channels: t.usageChannels ?? [],
  };
}

export function termsFromRecord(r: Record<string, unknown>): LicenseTerms {
  return licenseTermsSchema.parse({
    licenseType: r.license_type,
    mode: r.mode ?? "free_license",
    territory: r.territory ?? "Worldwide",
    startsOn: r.starts_on ?? null,
    endsOn: r.ends_on ?? null,
    modificationAllowed: !!r.modification_allowed,
    derivativesAllowed: !!r.derivatives_allowed,
    resaleAllowed: !!r.resale_allowed,
    attributionRequired: r.attribution_required !== false,
    feeAmount: r.fee_amount ?? null,
    feeCurrency: r.fee_currency ?? null,
    editionSize: r.edition_size ?? null,
    usageChannels: Array.isArray(r.usage_channels) ? r.usage_channels : [],
  });
}

/** Readable summary lines (no dense legal table), for review screens and request cards. */
export function describeTerms(t: LicenseTerms): string[] {
  const use = LICENSE_USES.find((u) => u.value === t.licenseType)?.label ?? t.licenseType;
  const mode = LICENSE_MODES.find((m) => m.value === t.mode)?.label ?? t.mode;
  const fee = t.feeAmount != null && t.feeCurrency ? `${t.feeCurrency} ${Number(t.feeAmount).toLocaleString("en", { maximumFractionDigits: 2 })}` : null;
  const lines = [`${use} · ${mode}${fee ? ` · ${fee}` : ""}${t.mode === "limited_edition" && t.editionSize ? ` · edition of ${t.editionSize}` : ""}`];
  if (t.usageChannels?.length) lines.push(`Channels: ${channelLabels(t.usageChannels).join(", ")}`);
  lines.push(`${t.territory}${t.startsOn || t.endsOn ? `, ${t.startsOn ?? "now"} – ${t.endsOn ?? "no end date"}` : ", no end date"}`);
  const allowed = [t.modificationAllowed && "changes", t.derivativesAllowed && "derivative works", t.resaleAllowed && "resale"].filter(Boolean) as string[];
  lines.push(allowed.length ? `Allows ${allowed.join(", ")}` : "No changes, derivatives or resale");
  lines.push(t.attributionRequired ? "Credit required" : "No credit required");
  return lines;
}

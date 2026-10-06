/**
 * License vocabulary (P0.1-08, P1-17): the modes, uses and channels, and their labels. Plain data — no validation
 * library — so the Creation page can show terms without shipping the license form's schemas (docs/performance.md).
 * The schemas live in licensing.ts, which re-exports all of this.
 */

export const LICENSE_MODES = [
  { value: "free", label: "Free to use", note: "No license needed beyond attribution" },
  { value: "free_license", label: "Free, with a license", note: "No fee, but the terms are recorded" },
  { value: "paid_nonexclusive", label: "Paid, non-exclusive", note: "A fee; you can license it to others too" },
  { value: "limited_edition", label: "Limited edition", note: "A set number of licenses" },
  { value: "exclusive", label: "Exclusive", note: "Only this licensee may use it this way" },
] as const;
export type LicenseMode = (typeof LICENSE_MODES)[number]["value"];

export const LICENSE_USES = [
  { value: "personal", label: "Personal use", note: "For personal viewing" },
  { value: "educational", label: "Educational use", note: "For non-commercial education" },
  { value: "editorial", label: "Editorial use", note: "For media and press" },
  { value: "promotional", label: "Promotional use", note: "To promote the work or creator" },
  { value: "internal", label: "Internal use", note: "Within one organisation" },
  { value: "commercial", label: "Commercial use", note: "For brand and commercial use" },
] as const;

/** Where licensed work may appear (P1-17). Recorded as terms, like everything else here. */
export const USAGE_CHANNELS = [
  { value: "social", label: "Social" },
  { value: "web", label: "Web" },
  { value: "print", label: "Print" },
  { value: "broadcast", label: "Broadcast" },
  { value: "streaming", label: "Streaming" },
  { value: "advertising", label: "Advertising" },
  { value: "packaging", label: "Packaging" },
  { value: "merchandise", label: "Merchandise" },
  { value: "events", label: "Events" },
  { value: "internal", label: "Internal" },
] as const;
export type UsageChannel = (typeof USAGE_CHANNELS)[number]["value"];
export const channelLabels = (c: readonly string[]) => c.map((v) => USAGE_CHANNELS.find((x) => x.value === v)?.label ?? v);

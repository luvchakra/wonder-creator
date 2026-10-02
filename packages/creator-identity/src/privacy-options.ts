/**
 * Privacy notice, consent purposes and data-principal request kinds (client-safe) — GDPR and India's DPDP Act 2023.
 * docs/compliance/privacy.md. Bump NOTICE_VERSION whenever the Terms or Privacy notice change materially: every
 * creator is then asked again before continuing.
 */
export const NOTICE_VERSION = "2026-10-02";

export const CONSENT_PURPOSES = ["terms", "privacy_notice", "age_confirmation", "product_analytics", "product_emails"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/** Needed to use the service at all (contract + notice + the age declaration). */
export const REQUIRED_CONSENTS: readonly ConsentPurpose[] = ["terms", "privacy_notice", "age_confirmation"];

export const CONSENT_LABEL: Record<ConsentPurpose, string> = {
  terms: "Terms of Service",
  privacy_notice: "Privacy notice",
  age_confirmation: "I'm 18 or older",
  product_analytics: "Help improve Wonder Creator with usage measures",
  product_emails: "Occasional emails about new features",
};

export const CONSENT_HINT: Partial<Record<ConsentPurpose, string>> = {
  product_analytics: "Counts of what's used and how long things take — never your content. Off unless you turn it on.",
  product_emails: "No marketing from anyone else, ever. Off unless you turn it on.",
};

export const REQUEST_KINDS = ["access", "correction", "erasure", "portability", "objection", "consent_withdrawal", "nomination", "grievance"] as const;
export type PrivacyRequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_LABEL: Record<PrivacyRequestKind, string> = {
  access: "A copy of my data / how it's used",
  correction: "Correct or complete my data",
  erasure: "Erase specific data",
  portability: "Move my data elsewhere",
  objection: "Object to or restrict a use",
  consent_withdrawal: "Withdraw a consent",
  nomination: "Nominate someone to act for me",
  grievance: "Raise a grievance",
};

export const REQUEST_STATUS_LABEL = { received: "Received", in_progress: "In progress", completed: "Completed", rejected: "Declined" } as const;

/** True when the required consents are missing or were given for an older notice. */
export function consentNeeded(current: ReadonlyArray<{ purpose: string; notice_version: string; granted: boolean }>): boolean {
  return REQUIRED_CONSENTS.some((p) => !current.some((c) => c.purpose === p && c.granted && c.notice_version === NOTICE_VERSION));
}

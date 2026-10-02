/**
 * Minimum safe context (spec §10–11): previews never carry booking references, payment details, contact details or
 * one-time codes, and mail about passwords, sign-ins or security is left out of discovery altogether.
 */

const PATTERNS: Array<[RegExp, string | ((m: string) => string)]> = [
  // Web links first (they carry ids): the place matters, the tracking URL doesn't.
  [/https?:\/\/\S+/gi, "[link]"],
  // Card-like digit runs (13–19 digits, optionally spaced or dashed).
  [/\b(?:\d[ -]?){13,19}\b/g, "[number]"],
  // Email addresses.
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]"],
  // Phone numbers: optional +country, 10+ digits with separators (dates have 8).
  [/(?:\+\d{1,3}[ -]?)?(?:\(?\d{2,5}\)?[ -]?){2,4}\d{2,5}\b/g, (m) => (m.replace(/\D/g, "").length >= 10 ? "[phone]" : m)],
  // Labelled references: PNR, booking, confirmation, order, ticket, invoice, OTP, code, reference — followed by an id.
  [/\b(PNR|booking|confirmation|order|ticket|invoice|reservation|ref(?:erence)?|OTP|code|passcode|pin)(\s*(?:no\.?|number|#|id)?\s*[:#-]?\s*)((?=[A-Z-]*\d)[A-Z0-9-]{4,})\b/gi, "$1$2[ref]"],
  // Long mixed letter-digit tokens (6–20) that look like codes, e.g. "X7KQ92".
  [/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6,20}\b/g, "[ref]"],
];

/** Redact identifiers from a short preview. */
export function redact(text: string): string {
  let out = text;
  for (const [re, rep] of PATTERNS) out = typeof rep === "string" ? out.replace(re, rep) : out.replace(re, rep);
  return out;
}

/** A short, single-paragraph, redacted excerpt — at most `max` characters, cut on a word. */
export function safeExcerpt(text: string | null | undefined, max = 280): string | null {
  if (!text) return null;
  const flat = redact(text.replace(/\s+/g, " ").trim());
  if (!flat) return null;
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

/** A safe title: redacted and kept short. */
export function safeTitle(text: string | null | undefined, max = 120): string | null {
  return safeExcerpt(text, max);
}

const SENSITIVE = [
  /\bpassword\b/i,
  /\bpasscode\b/i,
  /\b(?:one[- ]time|verification|security|login|sign[- ]in) (?:code|pin|alert|attempt)\b/i,
  /\bOTP\b/,
  /\b2fa\b|\btwo[- ]factor\b/i,
  /\bnew (?:sign[- ]in|login|device)\b/i,
  /\breset your\b/i,
  /\bverify your (?:email|account|identity)\b/i,
  /\bbank statement\b|\bcredit card statement\b|\baccount statement\b/i,
  /\b(?:tax|medical|diagnosis|prescription|lab) (?:report|result|return)s?\b/i,
];

/** Security, authentication and financial/medical statements are never discovered (spec §5, §11). */
export function isSensitive(...parts: Array<string | null | undefined>): boolean {
  const text = parts.filter(Boolean).join(" ");
  return SENSITIVE.some((re) => re.test(text));
}

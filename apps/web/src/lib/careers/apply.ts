import { failureMessage, type ApplicationInput, type Result } from "./client";

/**
 * An application, checked on this server before it is forwarded (docs/careers.md › Apply). Trimmed, held to WonderJobs'
 * limits, links https only. A hidden "website" field that people never see: anything typed into it is a bot, which is
 * told it worked and never forwarded. Nothing here is stored or logged.
 */
export const LIMITS = { name: 200, email: 254, phone: 40, location: 200, url: 600, coverNote: 4000 } as const;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim() : "").slice(0, max + 1);

function httpsUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !!u.hostname && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export type FieldErrors = Partial<Record<keyof ApplicationInput, string>>;

export function validateApplication(raw: unknown): { ok: true; input: ApplicationInput } | { ok: false; errors: FieldErrors } {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = str(b.name, LIMITS.name);
  const email = str(b.email, LIMITS.email).toLowerCase();
  const phone = str(b.phone, LIMITS.phone);
  const location = str(b.location, LIMITS.location);
  const linkedinUrl = str(b.linkedinUrl, LIMITS.url);
  const resumeUrl = str(b.resumeUrl, LIMITS.url);
  const coverNote = str(b.coverNote, LIMITS.coverNote);
  const errors: FieldErrors = {};
  if (!name) errors.name = "Enter your full name.";
  else if (name.length > LIMITS.name) errors.name = `Keep your name under ${LIMITS.name} characters.`;
  if (!email) errors.email = "Enter your email address.";
  else if (email.length > LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter an email address like name@example.com.";
  if (phone.length > LIMITS.phone) errors.phone = `Keep the phone number under ${LIMITS.phone} characters.`;
  if (location.length > LIMITS.location) errors.location = `Keep the location under ${LIMITS.location} characters.`;
  if (linkedinUrl && (linkedinUrl.length > LIMITS.url || !httpsUrl(linkedinUrl))) errors.linkedinUrl = "Use a full link that starts with https://.";
  if (!resumeUrl) errors.resumeUrl = "Add a link to your résumé.";
  else if (resumeUrl.length > LIMITS.url || !httpsUrl(resumeUrl)) errors.resumeUrl = "Use a full link that starts with https://.";
  if (coverNote.length > LIMITS.coverNote) errors.coverNote = `Keep the cover note under ${LIMITS.coverNote} characters.`;
  if (b.consent !== true) errors.consent = "Tick the box to agree before you apply.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    input: {
      name,
      email,
      resumeUrl,
      consent: true,
      ...(phone ? { phone } : {}),
      ...(location ? { location } : {}),
      ...(linkedinUrl ? { linkedinUrl } : {}),
      ...(coverNote ? { coverNote } : {}),
    },
  };
}

export const APPLIED = "Application sent. Check your email for a confirmation and a link to follow it.";
export const TRY_AGAIN = "Your application couldn't be sent just now. Please try again in a few minutes.";

export type ApplyReply = { status: number; body: { ok: true; message: string } | { error: string; fields?: FieldErrors; gone?: true }; retryAfter?: number };

/** The apply route's whole decision, with WonderJobs and the rate limit passed in (so it can be tested without either). */
export async function handleApplication(
  jobId: string,
  raw: unknown,
  deps: { limited: () => Promise<boolean>; apply: (id: string, input: ApplicationInput) => Promise<Result<{ id: string }>> },
): Promise<ApplyReply> {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // The honeypot: a bot gets the same answer as a person and nothing is sent.
  if (typeof body.website === "string" && body.website.trim()) return { status: 200, body: { ok: true, message: APPLIED } };
  if (await deps.limited()) return { status: 429, body: { error: "Too many applications from this network. Please try again in an hour." }, retryAfter: 3600 };
  const v = validateApplication(body);
  if (!v.ok) return { status: 400, body: { error: "Check the highlighted fields.", fields: v.errors } };
  const r = await deps.apply(jobId, v.input);
  if (r.ok) return { status: 200, body: { ok: true, message: APPLIED } };
  switch (r.kind) {
    case "bad_request":
      return { status: 400, body: { error: r.message } };
    case "conflict":
      return { status: 409, body: { error: r.message } };
    case "not_found":
      return { status: 404, body: { error: failureMessage(r), gone: true } };
    case "busy":
      return { status: 429, body: { error: failureMessage(r) }, retryAfter: r.retryAfter ?? 60 };
    default:
      return { status: 503, body: { error: TRY_AGAIN } };
  }
}

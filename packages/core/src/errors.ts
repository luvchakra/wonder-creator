/**
 * Domain errors carry a stable code, a human-readable (creator-facing) message and an HTTP status.
 * Internal details never leak to clients; they go to `cause` for server logs only.
 */
export type ErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "step_up_required"
  | "not_found"
  | "validation"
  | "conflict"
  | "rate_limited"
  | "payload_too_large"
  | "unsupported_media"
  | "security_rejected"
  | "provider_unavailable"
  | "provider_failed"
  | "cancelled"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  step_up_required: 403,
  not_found: 404,
  validation: 422,
  conflict: 409,
  rate_limited: 429,
  payload_too_large: 413,
  unsupported_media: 415,
  security_rejected: 422,
  provider_unavailable: 503,
  provider_failed: 502,
  cancelled: 409,
  internal: 500,
};

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown; details?: Record<string, unknown> }) {
    super(message, { cause: options?.cause });
    this.name = "DomainError";
    this.code = code;
    this.status = STATUS[code];
    this.details = options?.details;
  }
}

export const isDomainError = (e: unknown): e is DomainError => e instanceof DomainError;

/** Map a PostgREST / Postgres error to a DomainError without exposing internals. */
export function fromDbError(error: { code?: string; message?: string } | null | undefined, fallback = "Something went wrong."): DomainError {
  const code = error?.code ?? "";
  if (code === "42501" || code === "PGRST301") return new DomainError("forbidden", "You don't have access to that.", { cause: error });
  if (code === "P0002" || code === "PGRST116") return new DomainError("not_found", "We couldn't find that.", { cause: error });
  if (code === "23505") return new DomainError("conflict", "That already exists.", { cause: error });
  if (code === "22023" || code === "23514" || code === "22P02" || code === "23503") {
    return new DomainError("validation", "Some details weren't valid.", { cause: error });
  }
  return new DomainError("internal", fallback, { cause: error });
}

/** Unwrap a supabase-js response, throwing a DomainError on failure. */
export function must<T>(res: { data: T; error: { code?: string; message?: string } | null }, notFoundMessage?: string): NonNullable<T> {
  if (res.error) throw fromDbError(res.error);
  if (res.data === null || res.data === undefined) {
    throw new DomainError("not_found", notFoundMessage ?? "We couldn't find that.");
  }
  return res.data as NonNullable<T>;
}

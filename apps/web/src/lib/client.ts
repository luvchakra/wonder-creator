"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}

let wroteAt = 0;
/** When this tab last changed something through `api` (the bell reads its list again after a change, never sooner). */
export const lastWriteAt = () => wroteAt;

/** Fetch helper for Client Components: JSON in, JSON out, creator-readable errors. */
export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  if (rest.method && rest.method !== "GET" && rest.method !== "HEAD") wroteAt = Date.now();
  const res = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    let msg = res.status === 413 ? "That's too large to send. Try a smaller file." : "Something went wrong. Please try again.";
    let code = res.status === 413 ? "payload_too_large" : "internal";
    try {
      const body = (await res.json()) as { error?: { message?: string; code?: string } };
      msg = body.error?.message ?? msg;
      code = body.error?.code ?? code;
    } catch {
      /* non-JSON */
    }
    // Session expired: a full reload clears client state before signing in again.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (res.status === 401 && typeof window !== "undefined") window.location.href = "/sign-in";
    throw new ApiError(msg, code, res.status);
  }
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("application/json") ? res.json() : res.text()) as Promise<T>;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

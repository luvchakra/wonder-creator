import { createHash, randomBytes } from "node:crypto";
import { DomainError } from "@wonder/core";
import { ConnectorError } from "../errors";

/**
 * Google OAuth for Personal Sources (Gmail, Calendar): one client, a separate least-privilege consent per source,
 * never borrowed from Google sign-in. Offline access, PKCE (S256) and a random state.
 */

export const GOOGLE_SCOPES = {
  gmail: "https://www.googleapis.com/auth/gmail.readonly",
  google_calendar: "https://www.googleapis.com/auth/calendar.events.readonly",
} as const;
export type GoogleSource = keyof typeof GOOGLE_SCOPES;
export const GMAIL_SCOPE = GOOGLE_SCOPES.gmail;
export const CALENDAR_SCOPE = GOOGLE_SCOPES.google_calendar;

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export interface GoogleClient {
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}

/** A consent request: the URL to send the creator to, and the state + PKCE verifier to keep until they're back. */
export function googleConsent(client: GoogleClient, redirectUri: string, source: GoogleSource): { url: string; state: string; verifier: string } {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const u = new URL(AUTH_URL);
  u.search = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES[source],
    access_type: "offline",
    // Only this scope — signing in with Google grants nothing here (spec §2.11).
    include_granted_scopes: "false",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return { url: u.toString(), state, verifier };
}

/** Exchange the returned code for a refresh token; checks Google granted the source's read-only scope. */
export async function googleExchange(client: GoogleClient, source: GoogleSource, code: string, verifier: string, redirectUri: string): Promise<{ refreshToken: string; accessToken: string; scopes: string[] }> {
  const f = client.fetchImpl ?? fetch;
  const res = await f(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: client.clientId, client_secret: client.clientSecret, code, code_verifier: verifier, grant_type: "authorization_code", redirect_uri: redirectUri }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { refresh_token?: string; access_token?: string; scope?: string };
  if (!res.ok || !body.access_token) throw new DomainError("provider_failed", "Google didn't confirm the connection. Please try again.");
  const scopes = (body.scope ?? "").split(" ").filter(Boolean);
  if (!scopes.includes(GOOGLE_SCOPES[source])) throw new DomainError("forbidden", "Access wasn't granted, so nothing was connected.");
  if (!body.refresh_token) throw new DomainError("provider_failed", "Google didn't return lasting access. Please try connecting again.");
  return { refreshToken: body.refresh_token, accessToken: body.access_token, scopes: scopes.filter((s) => s === GOOGLE_SCOPES[source]) };
}

/** Tell Google to forget the grant (disconnect). Best effort: the stored credential is destroyed either way. */
export async function googleRevoke(client: GoogleClient, token: string): Promise<void> {
  const f = client.fetchImpl ?? fetch;
  await f(REVOKE_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }), signal: AbortSignal.timeout(8_000) }).catch(() => undefined);
}

/** A short-lived access token from the stored refresh token. */
export async function googleAccessToken(client: GoogleClient, refreshToken: string, signal: AbortSignal): Promise<string> {
  const f = client.fetchImpl ?? fetch;
  const res = await f(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: client.clientId, client_secret: client.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    signal,
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (res.ok && body.access_token) return body.access_token;
  if (body.error === "invalid_grant" || res.status === 401) throw new ConnectorError("revoked", "grant revoked");
  throw classifyGoogle(res);
}

/** Map a Google API response to a connector failure that stays with its source. */
export function classifyGoogle(res: Response): ConnectorError {
  if (res.status === 401) return new ConnectorError("revoked", "unauthorised");
  if (res.status === 429 || res.status === 403) {
    const ra = Number(res.headers.get("retry-after"));
    return new ConnectorError("rate_limited", `http ${res.status}`, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 60_000);
  }
  if (res.status >= 500) return new ConnectorError("retryable", `http ${res.status}`);
  return new ConnectorError("fatal", `http ${res.status}`);
}

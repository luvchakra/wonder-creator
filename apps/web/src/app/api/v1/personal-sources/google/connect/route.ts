import { DomainError } from "@wonder/core";
import { googleConsent } from "@wonder/creator-sources/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, googleClient, googleRedirectUri, sealOAuth } from "@/lib/sources";

const schema = z.object({ provider: z.enum(["gmail", "google_calendar"]) });

/**
 * POST /api/v1/personal-sources/google/connect — start a Google source's own consent (spec §5): read-only, one scope
 * per source, offline, PKCE. Signing in with Google is not permission to read mail or calendar, so this always asks.
 * Returns the Google URL to send the browser to.
 */
export const POST = withApi(
  async ({ creatorId, req }) => {
    const { provider } = schema.parse(await readJson(req));
    const client = googleClient();
    if (!client) throw new DomainError("provider_unavailable", "Google sources aren't set up on this server yet.");
    const c = googleConsent(client, googleRedirectUri(req.nextUrl.origin), provider);
    const res = NextResponse.json({ url: c.url });
    res.cookies.set(OAUTH_COOKIE, sealOAuth({ state: c.state, verifier: c.verifier, creatorId, provider, at: Date.now() }), {
      httpOnly: true,
      secure: req.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: OAUTH_COOKIE_PATH,
      maxAge: 600,
    });
    return res;
  },
  { feature: "personal_sources_enabled", rateLimit: 10 },
);

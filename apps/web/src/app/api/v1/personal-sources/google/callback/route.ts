import { isDomainError, log } from "@wonder/core";
import { googleExchange, requestSync } from "@wonder/creator-sources/server";
import { NextResponse, after } from "next/server";
import { withApi } from "@/lib/api";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, drainSync, googleClient, googleRedirectUri, openOAuth, sourcesDeps } from "@/lib/sources";
import { serviceClient } from "@/lib/supabase/service";

/**
 * GET /api/v1/personal-sources/google/callback — Google sends the creator back here. The sealed state must match the
 * one set for this creator in the last ten minutes; the code is exchanged with the PKCE verifier; the refresh token
 * goes straight into Vault. A first, bounded Quick Sync starts and the creator lands back on their sources.
 */
export const GET = withApi(
  async ({ creatorId, req }) => {
    const back = (q: string) => {
      const res = NextResponse.redirect(new URL(`/sources?${q}`, req.url));
      res.cookies.delete({ name: OAUTH_COOKIE, path: OAUTH_COOKIE_PATH });
      return res;
    };
    const p = req.nextUrl.searchParams;
    const sealed = openOAuth(req.cookies.get(OAUTH_COOKIE)?.value);
    const which = sealed?.provider === "google_calendar" ? "calendar" : "gmail";
    if (p.get("error")) return back(`${which}=declined`);
    const client = googleClient();
    if (!client || !sealed || sealed.creatorId !== creatorId || sealed.state !== p.get("state") || Date.now() - sealed.at > 600_000 || !p.get("code")) return back(`${which}=expired`);
    try {
      const grant = await googleExchange(client, sealed.provider, p.get("code")!, sealed.verifier, googleRedirectUri(req.nextUrl.origin));
      // Which account this is, shown to the creator (Gmail's address; Calendar's primary calendar id is its owner's address).
      const who =
        sealed.provider === "gmail"
          ? "https://gmail.googleapis.com/gmail/v1/users/me/profile"
          : "https://www.googleapis.com/calendar/v3/calendars/primary";
      const profile = (await (await fetch(who, { headers: { authorization: `Bearer ${grant.accessToken}` }, signal: AbortSignal.timeout(8_000) })).json().catch(() => ({}))) as { emailAddress?: string; id?: string };
      const account = (profile.emailAddress ?? profile.id ?? "").slice(0, 200) || null;
      const service = serviceClient();
      const fields = { status: "connected", granted_scopes: grant.scopes, account_display_name: account, last_error_code: null };
      const { data: existing } = await service.from("source_connections").select("id").eq("creator_id", creatorId).eq("provider", sealed.provider).maybeSingle();
      const id = existing
        ? (await service.from("source_connections").update(fields).eq("id", existing.id).select("id").single()).data!.id
        : (await service.from("source_connections").insert({ creator_id: creatorId, provider: sealed.provider, ...fields }).select("id").single()).data!.id;
      const stored = await service.rpc("source_secret_store", { p_creator: creatorId, p_connection: id, p_secret: grant.refreshToken });
      if (stored.error) throw stored.error;
      await requestSync(sourcesDeps(), creatorId, { connectionId: id }).catch(() => undefined);
      after(() => drainSync(creatorId));
      return back(`${which}=connected`);
    } catch (e) {
      log("warn", "sources.google_connect_failed", { provider: sealed.provider, code: isDomainError(e) ? e.code : "internal" });
      return back(`${which}=${isDomainError(e) && e.code === "forbidden" ? "scope" : "failed"}`);
    }
  },
  { feature: "personal_sources_enabled", rateLimit: 10 },
);

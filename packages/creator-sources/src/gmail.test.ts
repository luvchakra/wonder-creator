import { describe, expect, it } from "vitest";
import { DEFAULT_BUDGETS } from "./budgets";
import { gmailConnector, gmailScope } from "./connectors/gmail";
import { CALENDAR_SCOPE, GMAIL_SCOPE, googleConsent, googleExchange } from "./connectors/google";
import { ConnectorError } from "./errors";
import type { ConnectorContext } from "./server";

type Handler = (url: URL, init?: RequestInit) => { status?: number; body?: unknown; headers?: Record<string, string> };

function fakeGoogle(handler: Handler) {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
    const r = handler(url, init);
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json", ...(r.headers ?? {}) } });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const msg = (id: string, subject: string, extra: Record<string, unknown> = {}) => ({
  id,
  internalDate: String(Date.parse("2026-10-11T08:00:00Z")),
  snippet: `Snippet for ${subject} &amp; more`,
  labelIds: ["INBOX"],
  payload: { headers: [{ name: "Subject", value: subject }, ...((extra.headers as unknown[]) ?? [])] },
  ...extra,
});

function ctx(over: Partial<ConnectorContext> = {}): ConnectorContext {
  return {
    service: null as never,
    creatorId: "creator",
    connection: { id: "conn", creator_id: "creator", provider: "gmail", status: "connected", scope_settings: {}, last_successful_sync_at: null },
    cursor: null,
    limit: 50,
    budgets: DEFAULT_BUDGETS,
    signal: AbortSignal.timeout(5000),
    now: new Date("2026-10-12T00:00:00Z"),
    ...over,
  };
}

const token = (url: URL) => (url.pathname === "/token" ? { body: { access_token: "at" } } : null);

describe("Gmail consent", () => {
  it("asks for read-only Gmail only, offline, with PKCE and state — never piggybacking on sign-in", () => {
    const c = googleConsent({ clientId: "cid", clientSecret: "s" }, "https://app.example/cb", "gmail");
    const u = new URL(c.url);
    expect(u.searchParams.get("scope")).toBe(GMAIL_SCOPE);
    expect(u.searchParams.get("include_granted_scopes")).toBe("false");
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("state")).toBe(c.state);
    expect(c.verifier.length).toBeGreaterThan(40);
    // Calendar asks for its own, narrower scope.
    expect(new URL(googleConsent({ clientId: "cid", clientSecret: "s" }, "https://app.example/cb", "google_calendar").url).searchParams.get("scope")).toBe(CALENDAR_SCOPE);
  });

  it("refuses a grant without the Gmail scope or without lasting access", async () => {
    const noScope = fakeGoogle(() => ({ body: { access_token: "a", refresh_token: "r", scope: "openid email" } }));
    await expect(googleExchange({ clientId: "c", clientSecret: "s", fetchImpl: noScope.fetchImpl }, "gmail", "code", "v", "https://x/cb")).rejects.toMatchObject({ code: "forbidden" });
    const noRefresh = fakeGoogle(() => ({ body: { access_token: "a", scope: GMAIL_SCOPE } }));
    await expect(googleExchange({ clientId: "c", clientSecret: "s", fetchImpl: noRefresh.fetchImpl }, "gmail", "code", "v", "https://x/cb")).rejects.toMatchObject({ code: "provider_failed" });
    const ok = fakeGoogle(() => ({ body: { access_token: "a", refresh_token: "r", scope: `${GMAIL_SCOPE} openid` } }));
    await expect(googleExchange({ clientId: "c", clientSecret: "s", fetchImpl: ok.fetchImpl }, "gmail", "code", "v", "https://x/cb")).resolves.toMatchObject({ refreshToken: "r" });
  });
});

describe("Gmail discovery", () => {
  it("first sync: a bounded recent window without spam, promotions or bulk mail; metadata only; then switches to history", async () => {
    const g = fakeGoogle((url) => {
      if (token(url)) return token(url)!;
      if (url.pathname.endsWith("/profile")) return { body: { historyId: "900", emailAddress: "me@example.com" } };
      if (url.pathname.endsWith("/messages")) return { body: { messages: [{ id: "a" }, { id: "b" }, { id: "c" }] } };
      if (url.pathname.endsWith("/messages/a")) return { body: msg("a", "Weekend in Goa") };
      if (url.pathname.endsWith("/messages/b")) return { body: msg("b", "This week's deals", { headers: [{ name: "List-Unsubscribe", value: "<mailto:x>" }] }) };
      if (url.pathname.endsWith("/messages/c")) return { body: msg("c", "Promo", { labelIds: ["INBOX", "CATEGORY_PROMOTIONS"] }) };
      return { status: 404 };
    });
    const conn = gmailConnector({ clientId: "c", clientSecret: "s", fetchImpl: g.fetchImpl }, async () => "refresh");
    const page = await conn.fetchPage(ctx());
    const list = g.calls.find((c) => c.includes("/messages?"))!;
    expect(decodeURIComponent(list.replace(/\+/g, " "))).toContain("newer_than:30d -in:spam -in:trash -category:promotions -category:social -category:forums");
    expect(g.calls.filter((c) => c.includes("format=full"))).toEqual([]);
    expect(g.calls.filter((c) => c.includes("format=metadata"))).toHaveLength(3);
    expect(page.items.map((i) => i.title)).toEqual(["Weekend in Goa"]);
    expect(page.items[0]!.excerpt).toBe("Snippet for Weekend in Goa & more");
    expect(page.done).toBe(true);
    expect(JSON.parse(page.nextCursor!)).toEqual({ mode: "history", historyId: "900", pageToken: null });
    expect(page.bytes).toBeGreaterThan(0);
  });

  it("respects the chosen look-back and sent mail", () => {
    expect(gmailScope({})).toEqual({ lookbackDays: 30, includeSent: false });
    expect(gmailScope({ lookbackDays: 90, includeSent: true })).toEqual({ lookbackDays: 90, includeSent: true });
    expect(gmailScope({ lookbackDays: 3650 })).toEqual({ lookbackDays: 30, includeSent: false });
  });

  it("next sync reads only history since the cursor; an expired history recovers with a bounded window", async () => {
    const g = fakeGoogle((url) => {
      if (token(url)) return token(url)!;
      if (url.pathname.endsWith("/history")) return { body: { history: [{ messagesAdded: [{ message: { id: "n", labelIds: ["INBOX"] } }] }], historyId: "950" } };
      if (url.pathname.endsWith("/messages/n")) return { body: msg("n", "Platform 3") };
      return { status: 404 };
    });
    const conn = gmailConnector({ clientId: "c", clientSecret: "s", fetchImpl: g.fetchImpl }, async () => "refresh");
    const page = await conn.fetchPage(ctx({ cursor: JSON.stringify({ mode: "history", historyId: "900", pageToken: null }) }));
    expect(g.calls.some((c) => c.includes("/history?startHistoryId=900"))).toBe(true);
    expect(g.calls.some((c) => c.includes("/messages?"))).toBe(false);
    expect(page.items.map((i) => i.title)).toEqual(["Platform 3"]);
    expect(JSON.parse(page.nextCursor!).historyId).toBe("950");

    const expired = fakeGoogle((url) => {
      if (token(url)) return token(url)!;
      if (url.pathname.endsWith("/history")) return { status: 404 };
      if (url.pathname.endsWith("/profile")) return { body: { historyId: "1200" } };
      return { status: 404 };
    });
    const c2 = gmailConnector({ clientId: "c", clientSecret: "s", fetchImpl: expired.fetchImpl }, async () => "refresh");
    const rec = await c2.fetchPage(ctx({ cursor: JSON.stringify({ mode: "history", historyId: "1", pageToken: null }), connection: { ...ctx().connection, last_successful_sync_at: "2026-10-09T00:00:00Z" } }));
    const cur = JSON.parse(rec.nextCursor!);
    expect(cur).toMatchObject({ mode: "list", historyId: "1200" });
    expect(cur.q).toContain("newer_than:4d");
    expect(rec.done).toBe(false);
  });

  it("reports revoked access, rate limits (with Retry-After) and outages as distinct failures", async () => {
    const revoked = gmailConnector({ clientId: "c", clientSecret: "s", fetchImpl: fakeGoogle(() => ({ status: 400, body: { error: "invalid_grant" } })).fetchImpl }, async () => "refresh");
    await expect(revoked.fetchPage(ctx())).rejects.toMatchObject({ kind: "revoked" });
    const none = gmailConnector({ clientId: "c", clientSecret: "s", fetchImpl: fakeGoogle(() => ({})).fetchImpl }, async () => null);
    await expect(none.fetchPage(ctx())).rejects.toMatchObject({ kind: "revoked" });
    const limited = gmailConnector({ clientId: "c", clientSecret: "s", fetchImpl: fakeGoogle((u) => token(u) ?? { status: 429, headers: { "retry-after": "120" } }).fetchImpl }, async () => "refresh");
    const err = await limited.fetchPage(ctx()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err).toMatchObject({ kind: "rate_limited", retryAfterMs: 120_000 });
    const down = gmailConnector({ clientId: "c", clientSecret: "s", fetchImpl: fakeGoogle((u) => token(u) ?? { status: 503 }).fetchImpl }, async () => "refresh");
    await expect(down.fetchPage(ctx())).rejects.toMatchObject({ kind: "retryable" });
  });

  it("fetches a body only on import, without quoted replies, booking references or contact details", async () => {
    const body = Buffer.from("Loved the train. PNR: 4521889012. Call +91 98765 43210.\n\nOn Mon, someone wrote:\n> old stuff").toString("base64url");
    const g = fakeGoogle((url) => token(url) ?? { body: { payload: { headers: [{ name: "Subject", value: "Goa by train" }], mimeType: "multipart/alternative", parts: [{ mimeType: "text/plain", body: { data: body } }] } } });
    const conn = gmailConnector({ clientId: "c", clientSecret: "s", fetchImpl: g.fetchImpl }, async () => "refresh");
    const full = await conn.hydrate!(ctx(), { providerItemId: "m1", sourceType: "email" });
    expect(full.title).toBe("Goa by train");
    expect(full.text).toContain("Loved the train.");
    expect(full.text).not.toMatch(/4521889012|98765|old stuff/);
  });
});

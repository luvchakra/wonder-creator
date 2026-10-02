import { describe, expect, it } from "vitest";
import { DEFAULT_BUDGETS } from "./budgets";
import { calendarConnector, calendarScope, placeOf } from "./connectors/calendar";
import type { ConnectorContext } from "./server";

function fake(handler: (url: URL) => { status?: number; body?: unknown }) {
  const calls: URL[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.pathname === "/token") return new Response(JSON.stringify({ access_token: "at" }), { status: 200 });
    const r = handler(url);
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const ctx = (over: Partial<ConnectorContext> = {}): ConnectorContext => ({
  service: null as never,
  creatorId: "c",
  connection: { id: "k", creator_id: "c", provider: "google_calendar", status: "connected", scope_settings: {}, last_successful_sync_at: null },
  cursor: null,
  limit: 50,
  budgets: DEFAULT_BUDGETS,
  signal: AbortSignal.timeout(5000),
  now: new Date("2026-10-12T00:00:00Z"),
  ...over,
});

describe("Calendar discovery", () => {
  it("first sync reads a bounded window (30 back, 60 ahead) and keeps only title, date and town", async () => {
    const g = fake(() => ({
      body: {
        items: [
          { id: "e1", summary: "Sunday in Pune", location: "Vohuman Cafe, Dhole Patil Rd, Pune, Maharashtra 411001, India", start: { dateTime: "2026-10-11T09:00:00+05:30" }, attendees: [{ email: "x@y.z" }], description: "door code 4411" },
          { id: "e2", summary: "Team sync", hangoutLink: "https://meet.example/abc", start: { dateTime: "2026-10-10T09:00:00Z" } },
          { id: "e3", summary: "Dinner", status: "cancelled", start: { dateTime: "2026-10-09T09:00:00Z" } },
          { id: "e4", summary: "Party", attendees: [{ self: true, responseStatus: "declined" }], start: { dateTime: "2026-10-08T09:00:00Z" } },
          { id: "e5", summary: "Out of office", eventType: "outOfOffice", start: { date: "2026-10-07" } },
          { id: "e6", summary: "Goa trip", location: "Goa, India", start: { date: "2026-11-01" } },
        ],
        nextSyncToken: "sync-1",
      },
    }));
    const conn = calendarConnector({ clientId: "c", clientSecret: "s", fetchImpl: g.fetchImpl }, async () => "refresh");
    const page = await conn.fetchPage(ctx());
    const q = g.calls.find((u) => u.pathname.endsWith("/events"))!.searchParams;
    expect(q.get("timeMin")).toBe("2026-09-12T00:00:00.000Z");
    expect(q.get("timeMax")).toBe("2026-12-11T00:00:00.000Z");
    expect(page.items.map((i) => [i.title, i.place])).toEqual([
      ["Sunday in Pune", "Pune"],
      ["Goa trip", "Goa"],
    ]);
    expect(JSON.stringify(page.items)).not.toMatch(/4411|x@y\.z|Dhole|meet\.example/);
    expect(page.done).toBe(true);
    expect(JSON.parse(page.nextCursor!)).toEqual({ mode: "sync", syncToken: "sync-1", pageToken: null });
  });

  it("next sync uses the sync token; an expired one (410) restarts the bounded window", async () => {
    const g = fake(() => ({ body: { items: [], nextSyncToken: "sync-2" } }));
    const conn = calendarConnector({ clientId: "c", clientSecret: "s", fetchImpl: g.fetchImpl }, async () => "refresh");
    const page = await conn.fetchPage(ctx({ cursor: JSON.stringify({ mode: "sync", syncToken: "sync-1", pageToken: null }) }));
    const q = g.calls.find((u) => u.pathname.endsWith("/events"))!.searchParams;
    expect(q.get("syncToken")).toBe("sync-1");
    expect(q.get("timeMin")).toBeNull();
    expect(JSON.parse(page.nextCursor!).syncToken).toBe("sync-2");

    const gone = calendarConnector({ clientId: "c", clientSecret: "s", fetchImpl: fake(() => ({ status: 410 })).fetchImpl }, async () => "refresh");
    const rec = await gone.fetchPage(ctx({ cursor: JSON.stringify({ mode: "sync", syncToken: "old", pageToken: null }) }));
    expect(JSON.parse(rec.nextCursor!)).toEqual({ mode: "window", pageToken: null });
    expect(rec.done).toBe(false);
  });

  it("scope stays within the offered windows", () => {
    expect(calendarScope({})).toEqual({ pastDays: 30, futureDays: 60 });
    expect(calendarScope({ pastDays: 90, futureDays: 0 })).toEqual({ pastDays: 90, futureDays: 0 });
    expect(calendarScope({ pastDays: 3650 })).toEqual({ pastDays: 30, futureDays: 60 });
  });

  it("reduces an address to its town, never the street", () => {
    expect(placeOf("Vohuman Cafe, Dhole Patil Rd, Pune, Maharashtra 411001, India")).toBe("Pune");
    expect(placeOf("1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA")).toBe("Mountain View");
    expect(placeOf("Vohuman Cafe, Pune")).toBe("Pune");
    expect(placeOf("Goa, India")).toBe("Goa");
    expect(placeOf("Kolkata")).toBe("Kolkata");
    expect(placeOf("https://meet.example/abc")).toBeNull();
    expect(placeOf(undefined)).toBeNull();
  });
});

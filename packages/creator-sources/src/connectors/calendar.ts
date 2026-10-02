import { ConnectorError } from "../errors";
import type { Connector, ConnectorContext, PageResult } from "../server";
import { classifyGoogle, googleAccessToken, googleRevoke, type GoogleClient } from "./google";

/**
 * Google Calendar (Personal Sources spec §5, phase C). Its own read-only consent (events only). A bounded window —
 * 30 days back, 60 ahead by default — of the primary calendar; then incremental with Calendar's sync token. An expired
 * token (410 Gone) recovers with the same bounded window, never the whole calendar.
 *
 * Only what gives a day its context is kept: the event's title, its date and the town or area it happened in. Never
 * attendees, descriptions, meeting links or full addresses (spec §5 "do not expose private attendees, meeting details
 * or calendar descriptions"). Declined and cancelled events are skipped, and so are working sessions with a video link.
 */

const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export interface CalendarScope {
  pastDays: number;
  futureDays: number;
}

export function calendarScope(settings: Record<string, unknown>): CalendarScope {
  const p = Number(settings.pastDays);
  const f = Number(settings.futureDays);
  return { pastDays: [7, 30, 90].includes(p) ? p : 30, futureDays: [0, 30, 60].includes(f) ? f : 60 };
}

type Cursor = { mode: "window"; pageToken: string | null } | { mode: "sync"; syncToken: string; pageToken: string | null };

type Event = {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  conferenceData?: unknown;
  eventType?: string;
  attendees?: Array<{ self?: boolean; responseStatus?: string }>;
};

export function calendarConnector(client: GoogleClient, secret: (creatorId: string, connectionId: string) => Promise<string | null>): Connector {
  const f = client.fetchImpl ?? fetch;
  const tokenFor = async (ctx: Pick<ConnectorContext, "creatorId" | "connection" | "signal">) => {
    const refresh = await secret(ctx.creatorId, ctx.connection.id);
    if (!refresh) throw new ConnectorError("revoked", "no credential");
    return googleAccessToken(client, refresh, ctx.signal);
  };

  return {
    provider: "google_calendar",
    scope: (s) => ({ ...calendarScope(s) }),
    async fetchPage(ctx: ConnectorContext): Promise<PageResult> {
      const scope = calendarScope(ctx.connection.scope_settings ?? {});
      const token = await tokenFor(ctx);
      const cur = parse(ctx.cursor) ?? { mode: "window", pageToken: null };
      const params = new URLSearchParams({ maxResults: String(Math.min(ctx.limit, 250)), singleEvents: "true", showDeleted: "false" });
      if (ctx.query) {
        // A targeted search: the creator's words over the past year (and the usual window ahead); no sync token.
        params.set("q", ctx.query);
        params.set("timeMin", new Date(ctx.now.getTime() - 365 * 86_400_000).toISOString());
        params.set("timeMax", new Date(ctx.now.getTime() + scope.futureDays * 86_400_000).toISOString());
      } else if (cur.mode === "window") {
        params.set("timeMin", new Date(ctx.now.getTime() - scope.pastDays * 86_400_000).toISOString());
        params.set("timeMax", new Date(ctx.now.getTime() + scope.futureDays * 86_400_000).toISOString());
      } else params.set("syncToken", cur.syncToken);
      if (cur.pageToken) params.set("pageToken", cur.pageToken);
      const res = await f(`${API}?${params}`, { headers: { authorization: `Bearer ${token}` }, signal: ctx.signal });
      // An expired sync token: start again from the bounded window.
      if (res.status === 410) return { items: [], nextCursor: JSON.stringify({ mode: "window", pageToken: null }), done: false };
      if (!res.ok) throw classifyGoogle(res);
      const text = await res.text();
      const body = JSON.parse(text) as { items?: Event[]; nextPageToken?: string; nextSyncToken?: string };
      const items = (body.items ?? []).filter(keep).map((e) => ({
        providerItemId: e.id,
        sourceType: "event" as const,
        occurredAt: e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T12:00:00Z` : null),
        title: e.summary ?? null,
        place: placeOf(e.location),
        hydrationLevel: 1 as const,
      }));
      const next: Cursor | null = body.nextPageToken
        ? { ...cur, pageToken: body.nextPageToken }
        : ctx.query
          ? null
          : body.nextSyncToken
          ? { mode: "sync", syncToken: body.nextSyncToken, pageToken: null }
          : null;
      return { items, nextCursor: next ? JSON.stringify(next) : ctx.query ? null : ctx.cursor, done: !body.nextPageToken, bytes: text.length };
    },
    async revoke(ctx) {
      const refresh = await secret(ctx.creatorId, ctx.connection.id);
      if (refresh) await googleRevoke(client, refresh);
    },
    // Importing an event brings its title and date only — the same minimum as discovery.
    async hydrate() {
      return { title: null, text: null };
    },
  };
}

function keep(e: Event): boolean {
  if (e.status === "cancelled") return false;
  if (e.attendees?.some((a) => a.self && a.responseStatus === "declined")) return false;
  if (e.eventType && e.eventType !== "default") return false; // out of office, focus time, working location
  if (e.hangoutLink || e.conferenceData) return false; // calls and meetings aren't the kind of day we're after
  return !!e.summary;
}

/**
 * The town or area from a location, never the street: "Vohuman Cafe, Dhole Patil Rd, Pune, Maharashtra 411001, India"
 * → "Pune"; "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA" → "Mountain View"; "Vohuman Cafe, Pune" → "Pune".
 */
export function placeOf(location: string | undefined): string | null {
  if (!location || /^https?:/i.test(location.trim())) return null;
  const segs = location
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const clean = (x: string) => x.slice(0, 80);
  // The segment before the postcode is the town.
  const post = segs.findLastIndex((x) => /\d{4,}|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}/.test(x));
  if (post > 0 && !/\d/.test(segs[post - 1]!)) return clean(segs[post - 1]!);
  if (post >= 0) {
    const words = segs[post]!.replace(/[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}|\d+/g, "").trim();
    if (words.length > 2) return clean(words);
  }
  const plain = segs.filter((x) => !/\d/.test(x));
  if (!plain.length) return null;
  if (plain.length === 1) return clean(plain[0]!);
  // Without a postcode: drop a trailing country, then take the last part.
  const rest = COUNTRIES.has(plain[plain.length - 1]!.toLowerCase()) ? plain.slice(0, -1) : plain;
  return rest.length ? clean(rest[rest.length - 1]!) : null;
}

const COUNTRIES = new Set(
  "india,usa,united states,united states of america,us,uk,united kingdom,england,scotland,wales,ireland,canada,australia,new zealand,france,germany,italy,spain,portugal,netherlands,belgium,switzerland,austria,japan,china,singapore,malaysia,thailand,indonesia,sri lanka,nepal,bangladesh,pakistan,uae,united arab emirates,saudi arabia,qatar,south africa,kenya,nigeria,egypt,brazil,mexico,argentina".split(","),
);

function parse(c: string | null): Cursor | null {
  if (!c) return null;
  try {
    const v = JSON.parse(c) as Cursor;
    return v && (v.mode === "window" || (v.mode === "sync" && typeof v.syncToken === "string")) ? v : null;
  } catch {
    return null;
  }
}

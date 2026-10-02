import { createHash } from "node:crypto";
import { ConnectorError } from "../errors";
import { classifyGoogle as classify, googleAccessToken as accessToken, googleRevoke, type GoogleClient } from "./google";
import type { Connector, ConnectorContext, PageResult } from "../server";
import { redact } from "../redact";

/**
 * Gmail (Personal Sources spec §5, phase B). Its own Google consent, separate from signing in, read-only, and only
 * what discovery needs:
 *   - first sync: a bounded recent window (default 30 days) of inbox (and optionally sent) mail, never spam, trash,
 *     promotions, social or forums; bulk mail (List-Unsubscribe / Precedence: bulk) is skipped;
 *   - metadata first: Subject, Date and Gmail's own snippet — never a body during discovery;
 *   - then incremental through Gmail's history (the cursor is a historyId); an expired history falls back to a bounded
 *     recent window, never a full-mailbox rebuild;
 *   - a body is fetched only for a message the creator chooses to bring in, and it's redacted then too.
 */

const API = "https://gmail.googleapis.com/gmail/v1/users/me";


export interface GmailScope {
  lookbackDays: 7 | 30 | 90;
  includeSent: boolean;
}

export function gmailScope(settings: Record<string, unknown>): GmailScope {
  const d = Number(settings.lookbackDays);
  return { lookbackDays: d === 7 || d === 90 ? d : 30, includeSent: settings.includeSent === true };
}

type Cursor = { mode: "list"; q: string; pageToken: string | null; historyId: string } | { mode: "history"; historyId: string; pageToken: string | null };

function query(scope: GmailScope, days: number): string {
  const where = scope.includeSent ? "{in:inbox in:sent}" : "in:inbox";
  return `${where} newer_than:${days}d -in:spam -in:trash -category:promotions -category:social -category:forums`;
}

/** The connector. `secret` reads the refresh token for a connection (server only). */
export function gmailConnector(client: GoogleClient, secret: (creatorId: string, connectionId: string) => Promise<string | null>): Connector {
  const f = client.fetchImpl ?? fetch;
  const get = async <T>(token: string, path: string, signal: AbortSignal): Promise<T & { _bytes: number }> => {
    const res = await f(`${API}${path}`, { headers: { authorization: `Bearer ${token}` }, signal });
    if (!res.ok) throw classify(res);
    const text = await res.text();
    return { ...(JSON.parse(text) as T), _bytes: text.length };
  };
  const tokenFor = async (ctx: Pick<ConnectorContext, "creatorId" | "connection" | "signal">) => {
    const refresh = await secret(ctx.creatorId, ctx.connection.id);
    if (!refresh) throw new ConnectorError("revoked", "no credential");
    return accessToken(client, refresh, ctx.signal);
  };

  return {
    provider: "gmail",
    scope: (s) => ({ ...gmailScope(s) }),
    async fetchPage(ctx: ConnectorContext): Promise<PageResult> {
      const scope = gmailScope(ctx.connection.scope_settings ?? {});
      const token = await tokenFor(ctx);
      let cur = parse(ctx.cursor);
      let bytes = 0;
      if (!cur) {
        // First sync: remember where history stands now, then walk a bounded recent window.
        const profile = await get<{ historyId: string }>(token, "/profile", ctx.signal);
        bytes += profile._bytes;
        cur = { mode: "list", q: query(scope, scope.lookbackDays), pageToken: null, historyId: profile.historyId };
      }

      let ids: string[] = [];
      let next: Cursor | null;
      if (cur.mode === "list") {
        const page = await get<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(
          token,
          `/messages?${new URLSearchParams({ q: cur.q, maxResults: String(ctx.limit), ...(cur.pageToken ? { pageToken: cur.pageToken } : {}) })}`,
          ctx.signal,
        );
        bytes += page._bytes;
        ids = (page.messages ?? []).map((m) => m.id);
        next = page.nextPageToken ? { ...cur, pageToken: page.nextPageToken } : { mode: "history", historyId: cur.historyId, pageToken: null };
      } else {
        try {
          const page = await get<{ history?: Array<{ messagesAdded?: Array<{ message: { id: string; labelIds?: string[] } }> }>; nextPageToken?: string; historyId?: string }>(
            token,
            `/history?${new URLSearchParams({ startHistoryId: cur.historyId, historyTypes: "messageAdded", maxResults: String(ctx.limit), ...(cur.pageToken ? { pageToken: cur.pageToken } : {}) })}`,
            ctx.signal,
          );
          bytes += page._bytes;
          ids = [...new Set((page.history ?? []).flatMap((h) => (h.messagesAdded ?? []).filter((m) => wanted(m.message.labelIds, scope)).map((m) => m.message.id)))];
          next = page.nextPageToken ? { ...cur, pageToken: page.nextPageToken } : { mode: "history", historyId: page.historyId ?? cur.historyId, pageToken: null };
        } catch (e) {
          // An expired history id (404): recover with a bounded recent window since the last sync, not a full rebuild.
          if (!(e instanceof ConnectorError) || e.message !== "http 404") throw e;
          const since = ctx.connection.last_successful_sync_at ? Math.ceil((ctx.now.getTime() - Date.parse(ctx.connection.last_successful_sync_at)) / 86_400_000) + 1 : scope.lookbackDays;
          const profile = await get<{ historyId: string }>(token, "/profile", ctx.signal);
          return { items: [], nextCursor: JSON.stringify({ mode: "list", q: query(scope, Math.min(since, scope.lookbackDays)), pageToken: null, historyId: profile.historyId }), done: false };
        }
      }

      const items = [];
      for (const id of ids) {
        const m = await get<{ id: string; internalDate?: string; snippet?: string; labelIds?: string[]; payload?: { headers?: Array<{ name: string; value: string }> } }>(
          token,
          `/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe&metadataHeaders=Precedence&metadataHeaders=Message-ID`,
          ctx.signal,
        );
        bytes += m._bytes;
        const h = (n: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? null;
        // Newsletters and bulk notifications aren't discovery material.
        if (h("List-Unsubscribe") || /bulk|list/i.test(h("Precedence") ?? "") || !wanted(m.labelIds, scope)) continue;
        items.push({
          providerItemId: m.id,
          sourceType: "email" as const,
          occurredAt: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null,
          title: h("Subject"),
          excerpt: m.snippet ? decodeEntities(m.snippet) : null,
          fingerprint: h("Message-ID") ? createHash("sha256").update(h("Message-ID")!).digest("hex").slice(0, 32) : null,
          hydrationLevel: 2 as const,
          bytes: m._bytes,
        });
      }
      // Done once the recent window is walked and history has nothing further on this pass.
      return { items, nextCursor: JSON.stringify(next), done: next.mode === "history" && !next.pageToken, bytes };
    },
    async revoke(ctx) {
      const refresh = await secret(ctx.creatorId, ctx.connection.id);
      if (refresh) await googleRevoke(client, refresh);
    },
    async hydrate(ctx, record) {
      const token = await tokenFor(ctx);
      const m = await get<{ payload?: GmailPart; snippet?: string }>(token, `/messages/${encodeURIComponent(record.providerItemId)}?format=full`, ctx.signal);
      const subject = m.payload?.headers?.find((x) => x.name.toLowerCase() === "subject")?.value ?? null;
      const body = plainText(m.payload) ?? m.snippet ?? "";
      // Even a chosen email comes in without booking references, codes or contact details (spec §10).
      return { title: subject ? redact(subject).slice(0, 200) : null, text: redact(stripQuoted(body)).slice(0, 20_000) };
    },
  };
}

function wanted(labels: string[] | undefined, scope: GmailScope): boolean {
  if (!labels) return true;
  if (labels.some((l) => l === "SPAM" || l === "TRASH" || l === "CATEGORY_PROMOTIONS" || l === "CATEGORY_SOCIAL" || l === "CATEGORY_FORUMS")) return false;
  return labels.includes("INBOX") || (scope.includeSent && labels.includes("SENT"));
}

function parse(c: string | null): Cursor | null {
  if (!c) return null;
  try {
    const v = JSON.parse(c) as Cursor;
    return v && (v.mode === "list" || v.mode === "history") && typeof v.historyId === "string" ? v : null;
  } catch {
    return null;
  }
}

type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[]; headers?: Array<{ name: string; value: string }> };

function plainText(p: GmailPart | undefined): string | null {
  if (!p) return null;
  if (p.mimeType === "text/plain" && p.body?.data) return Buffer.from(p.body.data, "base64url").toString("utf8");
  for (const part of p.parts ?? []) {
    const t = plainText(part);
    if (t) return t;
  }
  return null;
}

/** Drop quoted replies and signatures: the creator's own words are the point. */
function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const l of lines) {
    if (/^On .+wrote:$/.test(l.trim()) || l.trim() === "-- " || l.trim() === "--") break;
    if (l.startsWith(">")) continue;
    out.push(l);
  }
  return out.join("\n").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

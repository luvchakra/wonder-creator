import { fromDbError } from "@wonder/core";
import type { Connector, ConnectorContext, PageResult } from "../server";

/**
 * Wonder Creator's own notes (spec §5 "Notes": native first, no external connector). Incremental by an
 * (updated_at, id) watermark; the first sync looks back a bounded window, never the whole history. The notes already
 * are Materials, so the index only points at them and import reuses them.
 */
export const NOTE_TYPES = ["note", "idea", "text"] as const;
const LOOKBACK_DAYS = 180;

export const nativeNotes: Connector = {
  provider: "native_notes",
  scope: () => ({ types: [...NOTE_TYPES], lookbackDays: LOOKBACK_DAYS }),
  async fetchPage(ctx: ConnectorContext): Promise<PageResult> {
    // A targeted search may look further back (three years), still in bounded pages.
    const days = ctx.query ? 3 * 365 : LOOKBACK_DAYS;
    const [at, id] = parseCursor(ctx.cursor) ?? [new Date(ctx.now.getTime() - days * 86_400_000).toISOString(), "00000000-0000-0000-0000-000000000000"];
    let q = ctx.service
      .from("creative_materials")
      .select("id, title, text_content, created_at, updated_at, metadata, source_type")
      .eq("creator_id", ctx.creatorId)
      .eq("status", "active")
      .in("type", [...NOTE_TYPES])
      .or(`updated_at.gt.${at},and(updated_at.eq.${at},id.gt.${id})`);
    if (ctx.query) q = q.or(`title.ilike.*${ctx.query}*,text_content.ilike.*${ctx.query}*`);
    const { data, error } = await q.order("updated_at").order("id").limit(ctx.limit).abortSignal(ctx.signal);
    if (error) throw fromDbError(error);
    const rows = (data ?? []).filter((m) => !m.source_type?.startsWith("personal_source:"));
    const last = data?.[data.length - 1];
    return {
      items: rows.map((m) => {
        const text = (m.text_content ?? "").slice(0, 2000);
        const meta = (m.metadata ?? {}) as Record<string, unknown>;
        return {
          providerItemId: m.id,
          sourceType: "note" as const,
          occurredAt: m.created_at,
          title: m.title,
          excerpt: text,
          place: typeof meta.place === "string" ? meta.place : null,
          materialId: m.id,
          hydrationLevel: 2 as const,
          signals: { unfinished: isUnfinished(text) },
          bytes: text.length + (m.title?.length ?? 0),
        };
      }),
      nextCursor: last ? `${last.updated_at}|${last.id}` : ctx.cursor,
      done: (data?.length ?? 0) < ctx.limit,
    };
  },
};

function parseCursor(c: string | null): [string, string] | null {
  if (!c) return null;
  const [at, id] = c.split("|");
  return at && id && !Number.isNaN(Date.parse(at)) && /^[0-9a-f-]{36}$/.test(id) ? [at, id] : null;
}

/** A thought the creator left mid-way: it trails off, or stops on a comma, dash or colon. */
export function isUnfinished(text: string): boolean {
  const t = text.trim();
  if (t.length < 12) return false;
  return /(\.\.\.|…|—|–|-|,|:|;)$/.test(t);
}

import "server-only";
import { isDomainError, log } from "@wonder/core";
import { selectProvider, summarizeConversation, type SummaryPoint } from "@wonder/creator-brain";
import type { Db } from "@wonder/db";
import { after } from "next/server";
import { flags } from "./features";
import { serviceClient, serviceConfigured } from "./supabase/service";

/**
 * "Conversation so far" (Phase 05 §9): a few points summarising a long Open Conversation, each linked to the replies it
 * comes from. Reading never waits on a model: the page shows what's stored and, when enough new replies have arrived,
 * a fresh summary is written in the background for the next visit. With no live model there's simply no summary.
 */
export const SUMMARY_MIN_REPLIES = 6;
export const SUMMARY_REFRESH_AFTER = 4;

export interface ConversationSummaryView {
  points: SummaryPoint[];
  /** Replies posted since it was written — shown as "from earlier" once it falls behind. */
  newer: number;
  stale: boolean;
  generatedAt: string;
}

export async function readSummary(db: Db, conversationId: string, replyCount: number): Promise<ConversationSummaryView | null> {
  if (!flags().conversation_summaries_enabled) return null;
  const { data } = await db.from("open_conversation_summaries").select("points, reply_count_at, generated_at").eq("conversation_id", conversationId).maybeSingle();
  if (!data) return null;
  const newer = Math.max(0, replyCount - data.reply_count_at);
  return { points: (data.points as unknown as SummaryPoint[]) ?? [], newer, stale: newer >= SUMMARY_REFRESH_AFTER || replyCount < data.reply_count_at, generatedAt: data.generated_at };
}

const inFlight = new Set<string>();

/** Write a fresh summary after the response when the conversation is long enough and the stored one is behind. */
export function refreshSummaryLater(conversationId: string, replyCount: number, current: ConversationSummaryView | null) {
  if (!flags().conversation_summaries_enabled || !serviceConfigured() || replyCount < SUMMARY_MIN_REPLIES) return;
  if (current && !current.stale) return;
  const provider = selectProvider();
  if (!provider.live || inFlight.has(conversationId)) return;
  inFlight.add(conversationId);
  after(async () => {
    try {
      const service = serviceClient();
      const { data: c } = await service.from("open_conversations").select("title, body, removed_at").eq("id", conversationId).maybeSingle();
      if (!c || c.removed_at) return;
      // Only what everyone in it can read: removed and deleted replies never reach the model.
      const { data: replies } = await service
        .from("open_conversation_replies")
        .select("id, body")
        .eq("conversation_id", conversationId)
        .is("deleted_at", null)
        .is("removed_at", null)
        .order("created_at")
        .limit(200);
      const points = await summarizeConversation(provider, { title: c.title, body: c.body, replies: (replies ?? []).map((r) => ({ id: r.id, text: r.body })) });
      if (!points) return;
      await service
        .from("open_conversation_summaries")
        .upsert({ conversation_id: conversationId, points: points as never, reply_count_at: replies?.length ?? 0, generated_at: new Date().toISOString() }, { onConflict: "conversation_id" });
    } catch (e) {
      log("warn", "community.summary_failed", { code: isDomainError(e) ? e.code : "internal" });
    } finally {
      inFlight.delete(conversationId);
    }
  });
}

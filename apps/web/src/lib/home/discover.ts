import "server-only";
import { isDomainError, log } from "@wonder/core";
import { discoverConnections } from "@wonder/creator-moments";
import type { Db } from "@wonder/db";
import { after } from "next/server";
import { flags } from "../features";
import { serviceClient, serviceConfigured } from "../supabase/service";

const last = new Map<string, { at: number; sig: string }>();
const MIN_GAP_MS = 10_000;
const SAME_DATA_MS = 6 * 60 * 60_000;

/**
 * Look for new Moment connections after Home has answered (Phase 05 §22: CreativeMind is an async enhancement — Home
 * never waits for it). Runs again only when the creator's Moments or tags changed (or every few hours); what it finds
 * shows on a later visit.
 */
export function scheduleDiscovery(db: Db, creatorId: string) {
  if (!flags().semantic_connections_enabled || !serviceConfigured()) return;
  const now = Date.now();
  const prev = last.get(creatorId);
  if (prev && now - prev.at < MIN_GAP_MS) return;
  after(async () => {
    try {
      const [moments, tags] = await Promise.all([
        db.from("moment_references").select("id", { count: "exact", head: true }).eq("creator_id", creatorId).is("deleted_at", null),
        db.from("creative_material_tags").select("material_id", { count: "exact", head: true }).eq("creator_id", creatorId),
      ]);
      const sig = `${moments.count ?? 0}:${tags.count ?? 0}`;
      if (prev && prev.sig === sig && now - prev.at < SAME_DATA_MS) return;
      last.set(creatorId, { at: now, sig });
      if (last.size > 5000) last.delete(last.keys().next().value as string);
      const n = await discoverConnections(db, serviceClient(), creatorId, now);
      if (n) log("info", "creativemind.connections_found", { creatorId, count: n });
    } catch (e) {
      log("warn", "creativemind.connections_failed", { code: isDomainError(e) ? e.code : "internal" });
    }
  });
}

import { PROVIDER_LABEL, type Provider } from "@wonder/creator-sources";
import { notFound } from "next/navigation";
import { PaletteScope } from "@/components/creative-palette";
import { flagOn } from "@/lib/features";
import { requireSession } from "@/lib/session";
import { ManageSource } from "./manage-source";

export const metadata = { title: "Source settings" };

/** One source's settings (board "Manage source settings"): status, sync, what's private, disconnect. */
export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  if (!flagOn("personal_sources_enabled")) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db } = await requireSession();
  const { data: c } = await db.from("source_connections").select("id, provider, status, last_successful_sync_at, created_at, account_display_name, scope_settings").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ count: indexed }, { data: job }] = await Promise.all([
    db.from("source_context_records").select("id", { count: "exact", head: true }).eq("connection_id", id),
    db.from("source_sync_jobs").select("id, status, phase").eq("connection_id", id).in("status", ["queued", "running", "paused"]).limit(1).maybeSingle(),
  ]);
  const provider = c.provider as Provider;
  return (
    <>
      <PaletteScope context={{ page: "settings", strip: { label: `${PROVIDER_LABEL[provider]} settings` } }} />
      <ManageSource
        source={{ id: c.id, provider, label: PROVIDER_LABEL[provider], status: c.status, lastSyncedAt: c.last_successful_sync_at, connectedAt: c.created_at, indexed: indexed ?? 0, account: c.account_display_name, scope: (c.scope_settings ?? {}) as Record<string, unknown> }}
        activeJob={job ? { id: job.id, status: job.status, phase: job.phase } : null}
      />
    </>
  );
}

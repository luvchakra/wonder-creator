"use client";
import type { Provider } from "@wonder/creator-sources";
import { Button, ConfirmDialog, KIT, KitArt } from "@wonder/ui";
import { ChevronLeft, Lock, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { SourceIcon, phaseText } from "@/components/sources/source-bits";
import { useSync } from "@/components/sources/use-sync";
import { api, errorMessage } from "@/lib/client";

const WHAT: Record<Provider, string> = {
  native_notes: "Your notes and ideas from the last six months, then whatever's new each time you sync. They already live in Wonder Creator; syncing only finds the ones worth returning to.",
  gmail: "Recent mail only, never spam, promotions or security mail.",
  google_calendar: "A short window of past and upcoming events.",
  external_notes: "Notes you choose to import.",
  phone_photos: "Only the photos you select.",
  cloud_photos: "Only the albums you choose.",
};

export function ManageSource({
  source: s,
  activeJob,
}: {
  source: { id: string; provider: Provider; label: string; status: string; lastSyncedAt: string | null; connectedAt: string; indexed: number };
  activeJob: { id: string; status: string; phase: string } | null;
}) {
  const router = useRouter();
  const sync = useSync({ activeJobIds: activeJob ? [activeJob.id] : [] });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/personal-sources/connections/${s.id}`, { method: "DELETE" });
      router.replace("/sources");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/sources" className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-full px-2 text-[13.5px] text-ink-muted hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> Personal Sources
      </Link>
      <header className="relative isolate flex items-center gap-3">
        <SourceIcon provider={s.provider} className="size-14" />
        <div className="min-w-0">
          <h1 className="font-display text-[26px] leading-tight text-ink">{s.label}</h1>
          <p className="text-[13px] text-ink-muted">
            {s.status === "needs_reconnect" ? "Needs reconnecting" : "Connected"}
            {s.lastSyncedAt ? (
              <>
                {" · "}Last synced <RelativeTime iso={s.lastSyncedAt} />
              </>
            ) : (
              " · Not synced yet"
            )}
          </p>
        </div>
      </header>

      <section aria-label="Sync" className="mt-4 rounded-2xl border border-border-soft bg-surface/95 px-3 py-3 shadow-[var(--shadow-card)]">
        <p className="text-[15px] font-medium text-ink">Sync this source</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">{WHAT[s.provider]}</p>
        <p className="mt-1 text-[12.5px] text-ink-subtle">
          {s.indexed} {s.indexed === 1 ? "item" : "items"} discovered · sync is manual
        </p>
        {sync.error ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {sync.error}
          </p>
        ) : null}
        <div className="mt-2.5 flex items-center gap-2">
          {sync.syncing ? (
            <>
              <p role="status" className="min-w-0 flex-1 text-[13px] text-ink-muted">
                {phaseText(s.provider, activeJob?.status ?? "running", activeJob?.phase ?? "checking")}
              </p>
              <Button size="sm" variant="ghost" onClick={() => void sync.cancel()}>
                Cancel
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" loading={sync.starting} onClick={() => void sync.start(s.id)}>
              <RefreshCw className="size-4" aria-hidden /> Sync now
            </Button>
          )}
        </div>
      </section>

      <section aria-label="Privacy" className="relative isolate mt-3 overflow-hidden rounded-2xl border border-border-soft bg-surface/95 px-3 py-3 shadow-[var(--shadow-card)]">
        <KitArt art={KIT.painted.leafSprigSage} sizes="5rem" className="pointer-events-none absolute -bottom-3 -right-2 -z-10 h-auto w-20 opacity-60" />
        <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
          <Lock className="size-4 text-accent" aria-hidden /> Privacy
        </p>
        <p className="mt-1 pr-12 text-[13px] leading-snug text-ink-muted">
          What&rsquo;s discovered stays private to you and is only used to suggest things worth creating from. Previews leave out contact details, booking references and codes, and
          expire after 30 days unless you bring something in. Nothing is shared or published unless you do it yourself, and your data never trains AI models.
        </p>
      </section>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-danger/20 bg-danger/5 text-[14px] font-medium text-danger hover:bg-danger/10"
      >
        <Trash2 className="size-4" aria-hidden /> Disconnect {s.label}
      </button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Disconnect ${s.label}?`}
        body="Wonder Creator stops looking at this source and deletes everything it discovered from it, including suggestions. Materials you already brought in stay where they are."
        confirmLabel="Disconnect"
        destructive
        busy={busy}
        onConfirm={() => void disconnect()}
      />
    </div>
  );
}

"use client";
import type { Provider } from "@wonder/creator-sources";
import { Button, ConfirmDialog, KIT, KitArt, Segmented, Switch } from "@wonder/ui";
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
  gmail: "Recent mail only — never spam, promotions, newsletters or security mail — and only subjects and Gmail's short previews until you bring something in.",
  google_calendar: "A short window of past and upcoming events — only each event's title, date and town. Never attendees, descriptions, call links or addresses; declined, cancelled and online meetings are left out.",
  external_notes: "Notes you choose to import.",
  phone_photos: "Only the photos you select.",
  cloud_photos: "Only the albums you choose.",
};

export function ManageSource({
  source: s,
  activeJob,
}: {
  source: { id: string; provider: Provider; label: string; status: string; lastSyncedAt: string | null; connectedAt: string; indexed: number; account: string | null; scope: Record<string, unknown> };
  activeJob: { id: string; status: string; phase: string } | null;
}) {
  const router = useRouter();
  const sync = useSync({ activeJobIds: activeJob ? [activeJob.id] : [] });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reconnect() {
    setBusy(true);
    try {
      const r = await api<{ url: string }>("/api/v1/personal-sources/google/connect", { method: "POST", json: { provider: s.provider } });
      window.location.assign(r.url);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

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
            {s.account ? ` · ${s.account}` : ""}
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

      {s.status === "needs_reconnect" && (s.provider === "gmail" || s.provider === "google_calendar") ? (
        <div role="status" className="mt-3 flex items-center gap-3 rounded-2xl bg-warning-soft px-3 py-2.5">
          <p className="min-w-0 flex-1 text-[13.5px] text-warning-ink">Google no longer lets Wonder Creator read this {s.provider === "gmail" ? "mailbox" : "calendar"}. Reconnect to keep syncing.</p>
          <Button size="sm" variant="secondary" loading={busy} onClick={() => void reconnect()}>
            Reconnect
          </Button>
        </div>
      ) : null}

      {s.provider === "gmail" ? <GmailScope id={s.id} scope={s.scope} /> : s.provider === "google_calendar" ? <CalendarScope id={s.id} scope={s.scope} /> : null}

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

/** What Gmail discovery may look at (board "Gmail settings"): how far back, and whether mail you sent counts. */
function GmailScope({ id, scope }: { id: string; scope: Record<string, unknown> }) {
  const [days, setDays] = useState(String(scope.lookbackDays === 7 || scope.lookbackDays === 90 ? scope.lookbackDays : 30) as "7" | "30" | "90");
  const [sent, setSent] = useState(scope.includeSent === true);
  const [saved, setSaved] = useState<string | null>(null);
  async function save(next: { lookbackDays: number; includeSent: boolean }) {
    setSaved(null);
    try {
      await api(`/api/v1/personal-sources/connections/${id}`, { method: "PATCH", json: { scopeSettings: next } });
      setSaved("Saved — used from your next sync.");
    } catch (e) {
      setSaved(errorMessage(e));
    }
  }
  return (
    <section aria-labelledby="scope-title" className="mt-3 rounded-2xl border border-border-soft bg-surface/95 px-3 py-3 shadow-[var(--shadow-card)]">
      <h2 id="scope-title" className="text-[15px] font-medium text-ink">
        Sync scope
      </h2>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13.5px] text-ink-muted">Mail from the last</span>
        <Segmented
          label="How far back"
          value={days}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
          onChange={(v) => {
            setDays(v);
            void save({ lookbackDays: Number(v), includeSent: sent });
          }}
        />
      </div>
      <div className="mt-2 flex min-h-11 items-center justify-between gap-3">
        <span className="text-[13.5px] text-ink-muted">Include mail you sent</span>
        <Switch
          label="Include mail you sent"
          checked={sent}
          onCheckedChange={(v) => {
            setSent(v);
            void save({ lookbackDays: Number(days), includeSent: v });
          }}
        />
      </div>
      <p className="mt-1 text-[12.5px] text-ink-subtle">Newsletters, promotions, social and security mail are always left out.</p>
      {saved ? (
        <p role="status" className="mt-1 text-[12.5px] text-ink-muted">
          {saved}
        </p>
      ) : null}
    </section>
  );
}

/** Calendar's window: how far back and ahead discovery may look. */
function CalendarScope({ id, scope }: { id: string; scope: Record<string, unknown> }) {
  const [past, setPast] = useState(String([7, 30, 90].includes(Number(scope.pastDays)) ? scope.pastDays : 30) as "7" | "30" | "90");
  const [ahead, setAhead] = useState(String([0, 30, 60].includes(Number(scope.futureDays)) ? scope.futureDays : 60) as "0" | "30" | "60");
  const [saved, setSaved] = useState<string | null>(null);
  async function save(next: { pastDays: number; futureDays: number }) {
    setSaved(null);
    try {
      await api(`/api/v1/personal-sources/connections/${id}`, { method: "PATCH", json: { scopeSettings: next } });
      setSaved("Saved — used from your next sync.");
    } catch (e) {
      setSaved(errorMessage(e));
    }
  }
  return (
    <section aria-labelledby="scope-title" className="mt-3 rounded-2xl border border-border-soft bg-surface/95 px-3 py-3 shadow-[var(--shadow-card)]">
      <h2 id="scope-title" className="text-[15px] font-medium text-ink">
        Sync scope
      </h2>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13.5px] text-ink-muted">Events from the last</span>
        <Segmented
          label="How far back"
          value={past}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
          onChange={(v) => {
            setPast(v);
            void save({ pastDays: Number(v), futureDays: Number(ahead) });
          }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13.5px] text-ink-muted">and the next</span>
        <Segmented
          label="How far ahead"
          value={ahead}
          options={[
            { value: "0", label: "None" },
            { value: "30", label: "30 days" },
            { value: "60", label: "60 days" },
          ]}
          onChange={(v) => {
            setAhead(v);
            void save({ pastDays: Number(past), futureDays: Number(v) });
          }}
        />
      </div>
      {saved ? (
        <p role="status" className="mt-1 text-[12.5px] text-ink-muted">
          {saved}
        </p>
      ) : null}
    </section>
  );
}

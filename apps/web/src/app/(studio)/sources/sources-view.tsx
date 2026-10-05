"use client";
import { Button, KIT, KitArt, buttonClasses, cn } from "@wonder/ui";
import { ArrowRight, ChevronRight, Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { readPhoto, type LocalPhoto } from "@/components/sources/local-photos";
import { SourceIcon, phaseText } from "@/components/sources/source-bits";
import { api, errorMessage } from "@/lib/client";
import type { CandidateCard, SourceRow } from "@/lib/sources";
import { BackLink } from "@/components/back-link";

const ACTIVE = new Set(["queued", "running", "paused"]);
const MAX_PHOTOS = 200;

const RETURNED = (name: string, what: string): Record<string, { text: string; ok: boolean }> => ({
  connected: { text: `${name} is connected. A first, short sync of your recent ${what} has started.`, ok: true },
  declined: { text: `${name} wasn't connected — you cancelled at Google.`, ok: false },
  scope: { text: `${name} wasn't connected: access wasn't allowed on Google's screen.`, ok: false },
  expired: { text: "That connection attempt expired. Please try again.", ok: false },
  failed: { text: "Google didn't confirm the connection. Please try again.", ok: false },
});

export function SourcesView({ sources: initial, candidates, returned }: { sources: SourceRow[]; candidates: CandidateCard[]; returned?: { gmail?: string; calendar?: string } }) {
  const notice = returned?.gmail ? RETURNED("Gmail", "mail")[returned.gmail] : returned?.calendar ? RETURNED("Calendar", "events")[returned.calendar] : undefined;
  const router = useRouter();
  const [sources, setSources] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(() => initial.some((s) => s.activeJob));
  const connected = sources.filter((s) => s.connectionId);
  // Sync is for sources Wonder Creator can look at; Photos only ever has what the creator chose.
  const syncable = connected.filter((s) => !s.pick);
  const syncing = sources.some((s) => s.activeJob && ACTIVE.has(s.activeJob.status));

  // A server refresh brings new rows: take them (React's "adjust state on prop change" pattern, no effect).
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setSources(initial);
  }

  // Follow a running sync at a gentle cadence; the page stays fully usable meanwhile.
  useEffect(() => {
    if (!polling) return;
    let stop = false;
    let delay = 1500;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await api<{ sources: SourceRow[] }>("/api/v1/personal-sources/connections");
        if (stop) return;
        setSources(r.sources);
        if (!r.sources.some((s) => s.activeJob)) {
          setPolling(false);
          router.refresh();
          return;
        }
      } catch {
        // Try again shortly.
      }
      delay = Math.min(delay * 1.4, 8000);
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, delay);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [polling, router]);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  const sync = (connectionId?: string) =>
    run(connectionId ?? "all", async () => {
      await api("/api/v1/personal-sources/sync", { method: "POST", json: connectionId ? { connectionId } : {} });
      setSources((ss) => ss.map((s) => (s.connectionId && (!connectionId || s.connectionId === connectionId) ? { ...s, activeJob: s.activeJob ?? { id: "", status: "queued", phase: "queued", scanned: 0 } } : s)));
      setPolling(true);
    });
  const connect = (provider: string, oauth: boolean) =>
    run(provider, async () => {
      if (oauth) {
        // The provider's own consent screen; it sends the creator back to this page.
        const r = await api<{ url: string }>("/api/v1/personal-sources/google/connect", { method: "POST", json: { provider } });
        window.location.assign(r.url);
        return;
      }
      const r = await api<{ connection: { id: string } }>("/api/v1/personal-sources/connections", { method: "POST", json: { provider } });
      await api("/api/v1/personal-sources/sync", { method: "POST", json: { connectionId: r.connection.id } });
      setPolling(true);
      router.refresh();
    });
  // Photos: the browser's own picker; only fingerprints, dates and tiny thumbnails leave the device.
  const picker = useRef<HTMLInputElement>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  async function pickPhotos(files: FileList | null) {
    const list = [...(files ?? [])].slice(0, MAX_PHOTOS);
    if (!list.length) return;
    await run("phone_photos", async () => {
      let done = 0;
      let unreadable = 0;
      for (let i = 0; i < list.length; i += 25) {
        const batch: LocalPhoto[] = [];
        for (const f of list.slice(i, i + 25)) {
          const p = await readPhoto(f);
          if (p) batch.push(p);
          else unreadable++;
          done++;
          setPhotoNote(`Looking at ${done} of ${list.length} photos…`);
        }
        if (batch.length) await api("/api/v1/personal-sources/photos", { method: "POST", json: { photos: batch } });
      }
      setPhotoNote(`Looked at ${list.length - unreadable} ${list.length - unreadable === 1 ? "photo" : "photos"}${unreadable ? ` · ${unreadable} couldn't be read here` : ""}${files && files.length > MAX_PHOTOS ? ` · the first ${MAX_PHOTOS} only` : ""}.`);
      router.refresh();
    });
    if (picker.current) picker.current.value = "";
  }

  const cancel = () =>
    run("cancel", async () => {
      const ids = sources.map((s) => s.activeJob?.id).filter((x): x is string => !!x);
      await Promise.all(ids.map((id) => api(`/api/v1/personal-sources/sync/${id}/cancel`, { method: "POST" })));
      setPolling(true);
    });

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink home="/" homeLabel="Home" />
      <header className="relative isolate pr-24">
        <KitArt art={KIT.painted.lavenderSprig} sizes="7rem" priority className="pointer-events-none absolute -top-8 right-0 -z-10 h-auto w-24 opacity-90 sm:w-28" />
        <h1 className="font-display text-[28px] leading-tight text-ink sm:text-[34px]">Connect your world</h1>
        <p className="mt-1 text-[14px] text-ink-muted">Bring in what matters — on your terms.</p>
      </header>
      {connected.length ? (
        <Link
          href="/sources/search"
          className="mt-3 flex min-h-11 items-center gap-2 rounded-full border border-border-soft bg-surface/95 px-4 text-[14px] text-ink-subtle shadow-[var(--shadow-card)] hover:border-accent/40"
        >
          <Search className="size-4" aria-hidden /> Search your world
        </Link>
      ) : null}

      {notice ? (
        <p role="status" className={cn("mt-3 rounded-2xl px-3 py-2 text-[13.5px]", notice.ok ? "bg-success-soft text-success-ink" : "bg-warning-soft text-warning-ink")}>
          {notice.text}
        </p>
      ) : null}

      <ul aria-label="Your sources" className="mt-4 divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface/95 shadow-[var(--shadow-card)]">
        {sources.map((s) => (
          <li key={s.provider} className="flex min-h-16 items-center gap-3 px-3 py-2.5">
            <SourceIcon provider={s.provider} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-ink">{s.label}</p>
              <SourceStatus s={s} />
            </div>
            {s.pick ? (
              <span className="flex items-center">
                <Button size="sm" variant="soft" loading={busy === s.provider} onClick={() => picker.current?.click()}>
                  Select photos
                </Button>
                {s.connectionId ? (
                  <Link href={`/sources/${s.connectionId}`} aria-label={`Manage ${s.label}`} className="-mr-1 inline-flex size-11 items-center justify-center rounded-full text-ink-subtle hover:bg-surface-muted">
                    <ChevronRight className="size-5" aria-hidden />
                  </Link>
                ) : null}
              </span>
            ) : s.connectionId ? (
              <Link href={`/sources/${s.connectionId}`} aria-label={`Manage ${s.label}`} className="-mr-1 inline-flex size-11 items-center justify-center rounded-full text-ink-subtle hover:bg-surface-muted">
                <ChevronRight className="size-5" aria-hidden />
              </Link>
            ) : s.available ? (
              <Button size="sm" variant="soft" loading={busy === s.provider} onClick={() => void connect(s.provider, s.oauth)}>
                Connect
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      <input ref={picker} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-label="Choose photos" onChange={(e) => void pickPhotos(e.currentTarget.files)} />
      {photoNote ? (
        <p role="status" className="mt-2 text-[13px] text-ink-muted">
          {photoNote}
        </p>
      ) : null}

      <aside className="mt-3 flex gap-2.5 rounded-2xl bg-accent-softer/70 px-3 py-2.5 text-[13px] leading-snug text-ink-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <p>
          <span className="font-medium text-ink">Sync on your terms.</span> We only look for new or changed things when you sync, a little at a time, and nothing becomes a Material until you
          choose it.
        </p>
      </aside>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {syncable.length ? (
        <div className="mt-3">
          {syncing ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface/95 px-3 py-2" role="status">
              <Loader2 className="size-4 shrink-0 text-accent motion-safe:animate-spin" aria-hidden />
              <p className="min-w-0 flex-1 text-[13.5px] text-ink-muted">Syncing — keep creating, it runs on its own.</p>
              <Button size="sm" variant="ghost" loading={busy === "cancel"} onClick={() => void cancel()}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button className="w-full" loading={busy === "all"} onClick={() => void sync()}>
              <RefreshCw className="size-4" aria-hidden /> Sync now
            </Button>
          )}
        </div>
      ) : null}

      <section aria-labelledby="new-title" className="mt-6">
        <h2 id="new-title" className="font-display text-[21px] text-ink">
          New from your world
        </h2>
        {candidates.length ? (
          <ul className="mt-2 grid gap-2.5 sm:grid-cols-2">
            {candidates.map((c, i) => (
              <li key={c.id}>
                <Link href={`/sources/candidates/${c.id}`} className="group relative isolate flex h-full gap-3 overflow-hidden rounded-2xl border border-border-soft bg-surface/95 p-2.5 shadow-[var(--shadow-card)] hover:border-accent/40">
                  <span aria-hidden className="relative isolate size-20 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
                    {c.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.cover} alt="" className="size-full object-cover" />
                    ) : (
                      <>
                        <KitArt art={KIT.wash[WASHES[i % WASHES.length]!]} sizes="6rem" className="absolute inset-0 -z-10 size-full scale-125 object-cover" />
                        <KitArt art={KIT.painted[SPRIGS[i % SPRIGS.length]!]} sizes="5rem" className="absolute -bottom-1 -right-1 h-auto w-16 opacity-90" />
                      </>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[17px] leading-snug text-ink">{c.title}</span>
                    {c.counts ? <span className="block text-[12.5px] text-ink-muted">{c.counts}</span> : null}
                    <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-ink-subtle">{c.quote ? `“${c.quote}”` : (c.suggestion ?? c.explanation)}</span>
                    <span className={cn(buttonClasses({ variant: "soft", size: "sm" }), "mt-1.5 h-8")}>
                      Review <ArrowRight className="size-3.5" aria-hidden />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[13.5px] text-ink-muted">{connected.length ? "Nothing to explore yet. Sync to look at what's new." : "Connect a source to discover ideas, places and moments worth creating from."}</p>
        )}
      </section>
    </div>
  );
}

const WASHES = ["washLavender", "washPeach", "washMint", "washRose"] as const;
const SPRIGS = ["lavenderSprig", "blossomSprig", "leafSprigSage", "flowerBranch"] as const;

function SourceStatus({ s }: { s: SourceRow }) {
  if (s.activeJob && ACTIVE.has(s.activeJob.status)) {
    return (
      <p className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
        <Loader2 className="size-3 shrink-0 text-accent motion-safe:animate-spin" aria-hidden />
        {phaseText(s.provider, s.activeJob.status, s.activeJob.phase)}
      </p>
    );
  }
  if (s.paused) {
    return <p className="text-[12.5px] text-warning-ink">Paused for now on Wonder Creator&rsquo;s side — nothing you&rsquo;ve found is lost.</p>;
  }
  if (s.pick) {
    return (
      <p className="text-[12.5px] text-ink-subtle">
        {s.lastSyncedAt ? (
          <>
            Last chosen <RelativeTime iso={s.lastSyncedAt} />
          </>
        ) : (
          <>
            Only the photos you choose
            <span className="block">Originals stay on your device</span>
          </>
        )}
      </p>
    );
  }
  if (!s.connectionId) {
    return (
      <p className="text-[12.5px] text-ink-subtle">
        <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full border border-ink-subtle align-middle" />
        {s.available ? "Not connected" : "Not set up yet"}
        <span className="block text-ink-subtle">{s.hint}</span>
      </p>
    );
  }
  const trouble = s.status === "needs_reconnect" ? "Needs reconnecting" : s.status === "error" ? "Last sync didn't finish" : s.status === "partially_synced" ? "Partly synced" : null;
  return (
    <p className="text-[12.5px] text-ink-muted">
      <span aria-hidden className={cn("mr-1.5 inline-block size-2 rounded-full align-middle", trouble ? "bg-warning" : "bg-success")} />
      <span className={trouble ? "text-warning-ink" : "text-success-ink"}>{trouble ?? "Connected"}</span>
      {s.account ? <span className="text-ink-subtle"> · {s.account}</span> : null}
      {s.lastSyncedAt ? (
        <span className="block">
          Last synced <RelativeTime iso={s.lastSyncedAt} />
        </span>
      ) : (
        <span className="block">Not synced yet</span>
      )}
    </p>
  );
}

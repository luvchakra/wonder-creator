"use client";
import { Button, Input } from "@wonder/ui";
import { ChevronLeft, History, Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ItemPicker } from "@/components/sources/item-picker";
import { api, errorMessage } from "@/lib/client";
import type { CandidateItem } from "@/lib/sources";

const ACTIVE = new Set(["queued", "running", "paused"]);

export function SearchWorld({ initialQuery }: { initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const [items, setItems] = useState<CandidateItem[] | null>(null);
  const [round, setRound] = useState(0);
  const [looking, setLooking] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const terms = q.trim();

  // Search the index as the creator types (debounced); nothing is fetched from providers here.
  useEffect(() => {
    if (terms.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await api<{ items: CandidateItem[] }>(`/api/v1/personal-sources/search?q=${encodeURIComponent(terms)}`, { signal: ctrl.signal });
        setItems(r.items);
      } catch {
        // Aborted or offline: keep what's shown.
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [terms, round]);

  // Follow a "Look further back" search until it settles, then search again.
  useEffect(() => {
    if (!looking.length) return;
    let stop = false;
    let delay = 2000;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const states = await Promise.all(looking.map((id) => api<{ job: { status: string } }>(`/api/v1/personal-sources/sync/${id}`).then((r) => r.job.status).catch(() => "failed")));
      if (stop) return;
      if (!states.some((s) => ACTIVE.has(s))) {
        setLooking([]);
        setNote(states.includes("partially_complete") ? "Looked a year back, as far as one search goes." : "Looked a year back.");
        setRound((n) => n + 1);
        return;
      }
      delay = Math.min(delay * 1.4, 8000);
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, delay);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [looking]);

  async function lookBack() {
    setNote(null);
    try {
      const r = await api<{ jobs: Array<{ id: string; status: string }> }>("/api/v1/personal-sources/search", { method: "POST", json: { query: terms } });
      const ids = r.jobs.filter((j) => ACTIVE.has(j.status)).map((j) => j.id);
      if (ids.length) setLooking(ids);
      else setNote("Connect a source to look further back.");
    } catch (e) {
      setNote(errorMessage(e));
    }
  }

  const shown = terms.length >= 2 ? items : null;
  return (
    <div className="mx-auto max-w-2xl pb-4">
      <Link href="/sources" className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-full px-2 text-[13.5px] text-ink-muted hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> Personal Sources
      </Link>
      <h1 className="font-display text-[26px] leading-tight text-ink">Search your world</h1>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value.slice(0, 80))}
          placeholder="A place, a trip, a phrase…"
          aria-label="Search your world"
          className="rounded-full pl-10 pr-11 [&::-webkit-search-cancel-button]:hidden"
          autoFocus
        />
        {q ? (
          <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-0.5 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-subtle hover:text-ink">
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {shown ? (
        <>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p role="status" className="text-[13px] text-ink-muted">
              {shown.length ? `${shown.length} ${shown.length === 1 ? "thing" : "things"} found` : "Nothing found yet."} {note ? <span className="text-ink-subtle">· {note}</span> : null}
            </p>
            <Button size="sm" variant="ghost" disabled={!!looking.length} onClick={() => void lookBack()}>
              {looking.length ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden /> : <History className="size-4" aria-hidden />}
              {looking.length ? "Looking further back…" : "Look further back"}
            </Button>
          </div>
          {shown.length ? <ItemPicker key={shown.map((i) => i.id).join()} items={shown} importUrl="/api/v1/personal-sources/records/import" preselect={false} /> : null}
        </>
      ) : (
        <p className="mt-3 text-[13.5px] text-ink-muted">Search what Wonder Creator has found in your notes, photos, mail and calendar. Nothing new is read until you ask it to look further back.</p>
      )}
    </div>
  );
}

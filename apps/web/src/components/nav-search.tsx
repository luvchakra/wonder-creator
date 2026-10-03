"use client";
import { LiveBadge, Spinner, cn } from "@wonder/ui";
import { ArrowRight, FileText, Layers, MessageCircle, Search, Sparkles, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";

interface Results {
  materials: Array<{ id: string; title: string | null; type: string; related?: boolean }>;
  artifacts: Array<{ id: string; title: string; artifact_type: string; related?: boolean }>;
  creators: Array<{ id: string; display_name: string; handle: string }>;
  conversations: Array<{ id: string; conversationId: string; title: string; snippet: string }>;
  huddles: Array<{ huddleId: string; topic: string | null; participantNames: string[] }>;
  collections: Array<{ id: string; name: string; description: string | null }>;
}

/**
 * Search that opens inline in the navbar (owner request): the search pill becomes the field — across the whole bar on
 * phones — and quick results drop down beneath it. No modal, no page change until you pick something; Enter or "See
 * all results" goes to the full search page. Escape, an outside tap or picking a result closes it and returns focus.
 */
export function NavSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setRes(await api<Results>(`/api/v1/search?q=${encodeURIComponent(q)}`));
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const outside = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, onOpenChange]);

  const close = (refocus = true) => {
    onOpenChange(false);
    setQ("");
    setRes(null);
    if (refocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const term = q.trim();
  const shown = term.length >= 2 ? res : null;
  const empty = shown && !shown.materials.length && !shown.artifacts.length && !shown.creators.length && !shown.conversations.length && !shown.huddles.length && !shown.collections.length;

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onOpenChange(true)}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm text-ink-subtle transition-transform duration-150 hover:border-[#cfd0ff] active:scale-95 motion-reduce:transition-none sm:min-w-56 sm:px-4"
        aria-label="Search your creativity"
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden sm:inline">Search your creativity…</span>
      </button>
    );
  }

  return (
    <div
      ref={rootRef}
      role="search"
      aria-label="Search"
      className="w-full min-w-0 sm:w-[24rem] lg:w-[28rem]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (term.length < 2) return;
          close(false);
          router.push(`/explore?q=${encodeURIComponent(term)}`);
        }}
        className="flex h-11 items-center gap-2 rounded-full border border-accent/50 bg-surface pl-3.5 pr-1 shadow-[var(--shadow-card)] focus-within:border-accent"
      >
        <Search className="size-4 shrink-0 text-ink-subtle" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          enterKeyHint="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your creativity…"
          aria-label="Search"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-subtle focus:outline-none"
        />
        <button type="button" onClick={() => close()} aria-label="Close search" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-accent">
          <X className="size-4" aria-hidden />
        </button>
      </form>
      {term.length >= 2 ? (
        <div
          role="region"
          aria-label="Search results"
          aria-live="polite"
          className={cn(
            "absolute inset-x-0 top-full z-50 mx-auto max-h-[min(70dvh,34rem)] w-full max-w-7xl overflow-y-auto border-b border-border-soft bg-surface px-4 pb-3 pt-2 shadow-[var(--shadow-lift)]",
            "sm:inset-x-auto sm:right-6 sm:mt-1 sm:w-[min(36rem,calc(100vw-3rem))] sm:rounded-2xl sm:border motion-safe:animate-[fade-in_140ms_ease-out]",
          )}
        >
          <div className="space-y-3">
            {loading && !shown ? <Spinner label="Searching" /> : null}
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {empty ? <p className="py-2 text-sm text-ink-muted">Nothing found for “{term}”. Try another word.</p> : null}
            {shown ? (
              <>
                <Group title="Your creations" items={shown.artifacts.map((a) => ({ href: `/creations/${a.id}`, label: a.title, sub: a.related ? "Related in meaning" : undefined, icon: <Sparkles className="size-4" /> }))} onPick={() => close(false)} />
                <Group title="Your material" items={shown.materials.map((m) => ({ href: `/materials/${m.id}`, label: m.title || "Untitled", sub: m.related ? "Related in meaning" : undefined, icon: <FileText className="size-4" /> }))} onPick={() => close(false)} />
                <Group title="Collections" items={shown.collections.map((c) => ({ href: `/materials/collections/${c.id}`, label: c.name, sub: c.description ?? undefined, icon: <Layers className="size-4" /> }))} onPick={() => close(false)} />
                <Group title="Conversations" items={shown.conversations.map((c) => ({ href: `/create?c=${c.conversationId}`, label: c.title, sub: c.snippet, icon: <MessageCircle className="size-4" /> }))} onPick={() => close(false)} />
                <Group title="Creators" items={shown.creators.map((c) => ({ href: `/creators/${c.handle}`, label: c.display_name, sub: `@${c.handle}`, icon: <UserRound className="size-4" /> }))} onPick={() => close(false)} />
                <Group title="Live now" items={shown.huddles.map((h) => ({ href: `/huddles/${h.huddleId}`, label: h.topic || h.participantNames.join(" · "), icon: <LiveBadge /> }))} onPick={() => close(false)} />
              </>
            ) : null}
            <Link href={`/explore?q=${encodeURIComponent(term)}`} onClick={() => close(false)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-ink hover:underline">
              See all results and filters <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Group({ title, items, onPick }: { title: string; items: Array<{ href: string; label: string; sub?: string; icon: React.ReactNode }>; onPick: () => void }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">{title}</h3>
      <ul>
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} onClick={onPick} className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-1 hover:bg-surface-muted">
              <span className="text-ink-subtle">{i.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm text-ink">{i.label}</span>
                {i.sub ? <span className="block truncate text-xs text-ink-subtle">{i.sub}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

/** A suggested connection: the creator adds it or lets it go. Nothing is attached until they say so (phase 02 §7, §11). */
export function ConnectionActions({ momentId, suggestionId, name }: { momentId: string; suggestionId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  async function act(accept: boolean) {
    setBusy(true);
    try {
      await api(`/api/v1/moments/${momentId}/dejavu-suggestions/${suggestionId}/${accept ? "accept" : "dismiss"}`, { method: "POST" });
      setDone(accept ? `Added to “${name}”.` : "Okay — left as it is.");
      router.refresh();
    } catch (e) {
      setDone(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <p role="status" className="text-[13px] text-ink-muted">
        {done}
      </p>
    );
  return (
    <div className="flex items-center gap-1">
      <button type="button" disabled={busy} onClick={() => act(true)} className="inline-flex min-h-11 items-center">
        <span className="inline-flex h-8 items-center rounded-full bg-accent-softer px-3 text-[13px] font-medium text-accent-ink hover:bg-accent-soft">Add to {name}</span>
      </button>
      <button type="button" disabled={busy} onClick={() => act(false)} className="inline-flex min-h-11 items-center">
        <span className="inline-flex h-8 items-center rounded-full px-3 text-[13px] text-ink-muted hover:bg-surface-muted">Not now</span>
      </button>
    </div>
  );
}

/**
 * A connection CreativeMind found (Phase 05 §5, §15): open it, ask why it's here (the recorded evidence — never scores
 * or model reasoning), or let it go for good.
 */
export function FoundConnection({ id, text, href, why }: { id: string; text: string; href: string; why: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const mark = (status: "opened" | "dismissed") => api(`/api/v1/moment-connections/${id}`, { method: "PATCH", json: { status } }).catch(() => undefined);
  if (gone)
    return (
      <p role="status" className="px-3 py-2 text-[13px] text-ink-muted">
        Okay — it won&apos;t come back.
      </p>
    );
  return (
    <div className="px-3 py-2">
      <button
        type="button"
        onClick={() => {
          void mark("opened");
          router.push(href);
        }}
        className="block w-full text-left"
      >
        <span className="block text-[12px] font-medium uppercase tracking-[0.08em] text-ink-subtle">Your world is connecting</span>
        <span className="block font-display text-[15.5px] leading-snug text-ink">{text}</span>
      </button>
      <div className="flex flex-wrap items-center gap-x-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            if (!open) void api("/api/v1/telemetry", { method: "POST", json: { event: "connection_why_opened" } }).catch(() => undefined);
            setOpen((o) => !o);
          }}
          className="inline-flex min-h-11 items-center text-[13px] font-medium text-accent-ink hover:underline"
        >
          Why am I seeing this?
        </button>
        <button
          type="button"
          onClick={() => {
            setGone(true);
            void mark("dismissed").then(() => router.refresh());
          }}
          className="inline-flex min-h-11 items-center px-2 text-[13px] text-ink-muted hover:text-ink"
        >
          Dismiss
        </button>
      </div>
      {open ? (
        <ul aria-label="Why this connection" className="mb-1 list-disc space-y-0.5 pl-5 text-[13px] text-ink-muted">
          {why.length ? why.map((w) => <li key={w}>{w}</li>) : <li>They share a thread in your Moments.</li>}
        </ul>
      ) : null}
    </div>
  );
}

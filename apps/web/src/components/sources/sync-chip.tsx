"use client";
import { Loader2, RefreshCw } from "lucide-react";
import { useSync } from "./use-sync";

/** A small "↻ Sync" for Home: starts a sync of every connected source and stays out of the way while it runs. */
export function SyncChip({ activeJobIds }: { activeJobIds: string[] }) {
  const s = useSync({ activeJobIds });
  const busy = s.syncing || s.starting;
  return (
    <span className="inline-flex items-center gap-2">
      {s.error ? (
        <span role="alert" className="text-[12px] text-danger">
          {s.error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => void s.start()}
        disabled={busy}
        aria-label={busy ? "Syncing your sources" : "Sync your sources"}
        className="relative inline-flex h-8 items-center gap-1.5 rounded-full border border-border-soft bg-surface px-3 text-[13px] font-medium text-accent-ink before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] hover:bg-accent-softer disabled:opacity-70"
      >
        {busy ? <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
        {busy ? "Syncing…" : "Sync"}
      </button>
    </span>
  );
}

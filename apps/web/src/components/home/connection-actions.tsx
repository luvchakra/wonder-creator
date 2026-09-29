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

"use client";
import { OPEN_TO, OPEN_TO_LABEL, type OpenTo } from "@wonder/creator-community/shared";
import { cn } from "@wonder/ui";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client";

/** "Open to…" (Phase 03 §9): chosen by the creator, never inferred. Each tap saves. */
export function OpenToEditor() {
  const [prefs, setPrefs] = useState<OpenTo[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api<{ preferences: OpenTo[] }>("/api/v1/profile/open-to")
      .then((r) => live && setPrefs(r.preferences))
      .catch(() => live && setPrefs([]));
    return () => {
      live = false;
    };
  }, []);
  async function toggle(p: OpenTo) {
    if (!prefs) return;
    const next = prefs.includes(p) ? prefs.filter((x) => x !== p) : [...prefs, p];
    setPrefs(next);
    try {
      const r = await api<{ preferences: OpenTo[] }>("/api/v1/profile/open-to", { method: "PATCH", json: { preferences: next } });
      setPrefs(r.preferences);
      setStatus("Saved.");
    } catch (e) {
      setStatus(errorMessage(e));
    }
  }
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">Open to…</legend>
      <p className="text-[13px] text-ink-muted">Shown on your profile, and used to suggest where you could help. Nothing is assumed.</p>
      <div className="mt-1 flex flex-wrap gap-x-1.5">
        {OPEN_TO.map((p) => {
          const on = !!prefs?.includes(p);
          return (
            <button key={p} type="button" role="checkbox" aria-checked={on} disabled={!prefs} onClick={() => toggle(p)} className="inline-flex min-h-11 items-center">
              <span className={cn("inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium", on ? "bg-accent-soft text-accent-ink ring-1 ring-accent/30" : "bg-surface-muted text-ink-muted hover:text-ink")}>
                {on ? <Check className="size-3.5" aria-hidden /> : null}
                {OPEN_TO_LABEL[p]}
              </span>
            </button>
          );
        })}
      </div>
      <p role="status" className="text-[12.5px] text-ink-subtle">
        {status}
      </p>
    </fieldset>
  );
}

"use client";
import { Avatar, Button, Input } from "@wonder/ui";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

export type PickedCreator = { id: string; display_name: string; handle: string };

/** Find creators by name or @handle (only creators you can see). */
export function CreatorPicker({ id, label = "Find a creator", exclude = [], onPick, actionLabel = "Invite" }: { id: string; label?: string; exclude?: string[]; onPick: (c: PickedCreator) => void | Promise<void>; actionLabel?: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedCreator[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = q.trim().replace(/^@/, "");
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api<{ creators: PickedCreator[] }>(`/api/v1/search?type=creators&q=${encodeURIComponent(term)}`);
        setResults(r.creators);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const shown = q.trim().replace(/^@/, "").length >= 2 ? results.filter((c) => !exclude.includes(c.id)) : [];
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <Input id={id} className="mt-1" value={q} placeholder="Name or @handle" autoComplete="off" onChange={(e) => setQ(e.target.value)} aria-describedby={`${id}-status`} />
      <p id={`${id}-status`} className="sr-only" role="status">
        {searching ? "Searching" : q.trim().length >= 2 ? `${shown.length} creators found` : ""}
      </p>
      {shown.length ? (
        <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto" aria-label="Creators">
          {shown.map((c) => (
            <li key={c.id} className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-1 hover:bg-black/[0.03]">
              <Avatar name={c.display_name} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] text-ink">{c.display_name}</span>
                <span className="block truncate text-sm text-ink-muted">@{c.handle}</span>
              </span>
              <Button
                size="sm"
                variant="secondary"
                loading={busy === c.id}
                aria-label={`${actionLabel} ${c.display_name}`}
                onClick={async () => {
                  setBusy(c.id);
                  try {
                    await onPick(c);
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {actionLabel}
              </Button>
            </li>
          ))}
        </ul>
      ) : q.trim().length >= 2 && !searching ? (
        <p className="mt-2 text-sm text-ink-muted">No creators found.</p>
      ) : null}
    </div>
  );
}

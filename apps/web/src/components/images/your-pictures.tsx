"use client";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client";

/** The creator's own pictures to choose from (the Images page's Add, a Video shot's frame). */
export function YourPictures({ busy, onPick, verb = "Add" }: { busy: boolean; onPick: (materialId: string, previewUrl: string) => void; verb?: string }) {
  const [items, setItems] = useState<Array<{ id: string; title: string | null; previewUrl: string | null }> | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api<{ items: Array<{ id: string; title: string | null; previewUrl: string | null }> }>("/api/v1/materials?filter=images")
      .then((r) => live && setItems(r.items.filter((m) => m.previewUrl).slice(0, 24)))
      .catch((e) => live && setFailed(errorMessage(e)));
    return () => {
      live = false;
    };
  }, []);
  if (failed) return <p className="text-sm text-danger">{failed}</p>;
  if (!items) return <p className="text-[13px] text-ink-subtle">Looking for your pictures…</p>;
  if (!items.length) return <p className="text-[13px] text-ink-muted">No pictures yet. A Quick Pic from Home, or a picture brought in, will show here.</p>;
  return (
    <ul className="grid grid-cols-4 gap-1.5" aria-label="Your pictures">
      {items.map((m) => (
        <li key={m.id}>
          <button type="button" disabled={busy} onClick={() => onPick(m.id, m.previewUrl!)} aria-label={`${verb} ${m.title?.trim() || "this picture"}`} className="block aspect-square w-full overflow-hidden rounded-xl bg-cream-deep focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.previewUrl!} alt="" loading="lazy" className="size-full object-cover" />
          </button>
        </li>
      ))}
    </ul>
  );
}

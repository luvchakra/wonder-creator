"use client";
import { SOURCE_NOUN, type SourceType } from "@wonder/creator-sources";
import { Button, KIT, KitArt, cn } from "@wonder/ui";
import { Check, ChevronLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { LocalTime } from "@/components/client-time";
import { localOriginal, rememberOriginal, sha256Hex } from "@/components/sources/local-photos";
import { api, errorMessage } from "@/lib/client";
import type { CandidateCard, CandidateItem } from "@/lib/sources";

const ORDER: SourceType[] = ["photo", "note", "email", "event", "file"];
/** Mail and calendar are context by default: the creator opts them in (spec §10 "Travel booking email (context only)"). */
const CONTEXT_ONLY = new Set<SourceType>(["email", "event"]);

export function ReviewCandidate({ c }: { c: CandidateCard & { items: CandidateItem[] } }) {
  const router = useRouter();
  const [filter, setFilter] = useState<SourceType | "all">("all");
  const [picked, setPicked] = useState(() => new Set(c.items.filter((i) => !CONTEXT_ONLY.has(i.sourceType) && !i.imported).map((i) => i.id)));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kinds = ORDER.filter((t) => c.items.some((i) => i.sourceType === t));
  const shown = kinds.filter((t) => filter === "all" || filter === t);

  const toggle = (id: string) => setPicked((p) => (p.has(id) ? (p.delete(id), new Set(p)) : new Set(p.add(id))));
  const toggleKind = (t: SourceType) =>
    setPicked((p) => {
      const ids = c.items.filter((i) => i.sourceType === t && !i.imported).map((i) => i.id);
      const all = ids.every((id) => p.has(id));
      const next = new Set(p);
      ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
      return next;
    });

  const [missing, setMissing] = useState(0);
  const again = useRef<HTMLInputElement>(null);

  /** Upload the originals of the chosen photos (from this device, this visit) — only now, only these. */
  async function photoOriginals(): Promise<Record<string, string> | null> {
    const photos = c.items.filter((i) => i.sourceType === "photo" && picked.has(i.id) && !i.imported);
    const lacking = photos.filter((p) => !p.fingerprint || !localOriginal(p.fingerprint));
    if (lacking.length) {
      setMissing(lacking.length);
      return null;
    }
    const out: Record<string, string> = {};
    for (const p of photos) {
      const form = new FormData();
      form.append("files", localOriginal(p.fingerprint!)!);
      const r = await api<{ accepted: Array<{ materialId: string | null }>; rejected: Array<{ message: string }> }>("/api/v1/send", { method: "POST", body: form });
      const mid = r.accepted[0]?.materialId;
      if (!mid) throw new Error(r.rejected[0]?.message ?? "A photo couldn't be brought in.");
      out[p.id] = mid;
    }
    return out;
  }
  async function chooseAgain(files: FileList | null) {
    for (const f of [...(files ?? [])]) rememberOriginal(await sha256Hex(f), f);
    const still = c.items.filter((i) => i.sourceType === "photo" && picked.has(i.id) && !i.imported && (!i.fingerprint || !localOriginal(i.fingerprint))).length;
    setMissing(still);
    if (again.current) again.current.value = "";
  }

  async function bring(to: "materials" | "studio") {
    setBusy(to);
    setError(null);
    try {
      const photoMaterials = await photoOriginals();
      if (!photoMaterials) {
        setBusy(null);
        return;
      }
      const r = await api<{ next: string }>(`/api/v1/personal-sources/candidates/${c.id}/import`, { method: "POST", json: { recordIds: [...picked], to, photoMaterials } });
      router.push(r.next);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }
  async function dismiss() {
    setBusy("dismiss");
    try {
      await api(`/api/v1/personal-sources/candidates/${c.id}/dismiss`, { method: "POST" });
      router.replace("/sources");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl pb-4">
      <Link href="/sources" className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-full px-2 text-[13.5px] text-ink-muted hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> From your world
      </Link>
      <header className="relative isolate overflow-hidden rounded-2xl border border-border-soft bg-[image:var(--gradient-card)] px-4 py-4 shadow-[var(--shadow-card)]">
        <KitArt art={KIT.wash.washLavender} sizes="(min-width: 640px) 42rem, 100vw" priority className="absolute inset-0 -z-10 size-full object-cover opacity-70" />
        <KitArt art={KIT.painted.blossomSprig} sizes="7rem" priority className="pointer-events-none absolute -bottom-3 -right-2 -z-10 h-auto w-24 opacity-90" />
        <h1 className="pr-16 font-display text-[28px] leading-tight text-ink">{c.title}</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">{c.counts}</p>
        {c.quote ? (
          <p className="mt-2 pr-14 font-display text-[16px] italic leading-snug text-ink">“{c.quote}”</p>
        ) : c.explanation ? (
          <p className="mt-1.5 pr-14 text-[13.5px] text-ink-muted">{c.explanation}</p>
        ) : null}
      </header>
      <p className="mt-2 text-[13px] text-ink-muted">Choose what to bring in. The rest stays where it is.</p>

      {kinds.length > 1 ? (
        <div role="radiogroup" aria-label="Show" className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
          {(["all", ...kinds] as const).map((k) => {
            const n = k === "all" ? c.items.length : c.items.filter((i) => i.sourceType === k).length;
            const on = filter === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setFilter(k)}
                className={cn(
                  "relative inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[13px] before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-['']",
                  on ? "border-accent bg-accent-softer font-medium text-accent-ink" : "border-border-soft bg-surface text-ink-muted",
                )}
              >
                {k === "all" ? "All" : SOURCE_NOUN[k][1].replace(/^\w/, (x) => x.toUpperCase())} ({n})
              </button>
            );
          })}
        </div>
      ) : null}

      {shown.map((t) => {
        const items = c.items.filter((i) => i.sourceType === t);
        const selectable = items.filter((i) => !i.imported);
        const all = selectable.length > 0 && selectable.every((i) => picked.has(i.id));
        return (
          <section key={t} aria-labelledby={`k-${t}`} className="mt-4">
            <div className="flex items-center justify-between">
              <h2 id={`k-${t}`} className="text-[15px] font-semibold text-ink">
                {SOURCE_NOUN[t][1].replace(/^\w/, (x) => x.toUpperCase())} ({items.length})
                {CONTEXT_ONLY.has(t) ? <span className="ml-1.5 text-[12px] font-normal text-ink-subtle">context only unless you choose them</span> : null}
              </h2>
              {selectable.length > 1 ? (
                <button type="button" onClick={() => toggleKind(t)} className="inline-flex min-h-11 items-center text-[13px] font-medium text-accent-ink hover:underline">
                  {all ? "Deselect all" : "Select all"}
                </button>
              ) : null}
            </div>
            {t === "photo" ? (
              <ul className="mt-1 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {items.map((i) => {
                  const on = picked.has(i.id) || i.imported;
                  return (
                    <li key={i.id}>
                      <label className={cn("relative block aspect-square cursor-pointer overflow-hidden rounded-xl bg-surface-muted", i.imported && "cursor-default")}>
                        <input type="checkbox" className="peer sr-only" checked={on} disabled={i.imported} onChange={() => toggle(i.id)} aria-label={`Photo${i.occurredAt ? ` from ${new Date(i.occurredAt).toDateString()}` : ""}${i.imported ? " (already in your Materials)" : ""}`} />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {i.previewRef ? <img src={i.previewRef} alt="" className="size-full object-cover" /> : null}
                        <span aria-hidden className="absolute inset-0 rounded-xl ring-inset peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
                        <span aria-hidden className={cn("absolute left-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full border-2 border-white shadow", on ? "bg-accent text-white" : "bg-black/20")}>
                          {on ? <Check className="size-3.5" /> : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
            <ul className="mt-1 divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface/95 shadow-[var(--shadow-card)]">
              {items.map((i) => {
                const on = picked.has(i.id);
                return (
                  <li key={i.id}>
                    <label className={cn("flex min-h-14 cursor-pointer items-start gap-3 px-3 py-2.5", i.imported && "cursor-default opacity-70")}>
                      <input type="checkbox" className="peer sr-only" checked={on || i.imported} disabled={i.imported} onChange={() => toggle(i.id)} aria-describedby={`d-${i.id}`} />
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                          on || i.imported ? "border-accent bg-accent text-white" : "border-border bg-surface",
                        )}
                      >
                        {on || i.imported ? <Check className="size-4" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-ink">{i.title || SOURCE_NOUN[i.sourceType][0].replace(/^\w/, (x) => x.toUpperCase())}</span>
                        {i.excerpt ? (
                          <span id={`d-${i.id}`} className="line-clamp-2 block text-[12.5px] leading-snug text-ink-muted">
                            {i.excerpt}
                          </span>
                        ) : null}
                        <span className="block text-[12px] text-ink-subtle">
                          {i.imported ? "Already in your Materials · " : null}
                          {i.occurredAt ? <LocalTime iso={i.occurredAt} options={{ weekday: "short", day: "numeric", month: "short", year: "numeric" }} /> : null}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            )}
          </section>
        );
      })}

      {missing ? (
        <div role="status" className="mt-4 rounded-2xl bg-warning-soft px-3 py-2.5 text-[13.5px] text-warning-ink">
          To bring {missing === 1 ? "this photo" : `these ${missing} photos`} in at full quality, choose {missing === 1 ? "it" : "them"} again from your device — the originals never left it.
          <input ref={again} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-label="Choose the photos again" onChange={(e) => void chooseAgain(e.currentTarget.files)} />
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => again.current?.click()}>
            Choose photos
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-5 space-y-2">
        <Button className="w-full" disabled={!picked.size || !!busy} loading={busy === "materials"} onClick={() => void bring("materials")}>
          Add selected to Materials{picked.size ? ` · ${picked.size} ${picked.size === 1 ? "item" : "items"}` : ""}
        </Button>
        <Button className="w-full" variant="secondary" disabled={!picked.size || !!busy} loading={busy === "studio"} onClick={() => void bring("studio")}>
          <Sparkles className="size-4" aria-hidden /> Bring to Studio
        </Button>
        <button type="button" disabled={!!busy} onClick={() => void dismiss()} className="inline-flex min-h-11 w-full items-center justify-center text-[13px] text-ink-subtle hover:text-ink">
          Not this one
        </button>
      </div>
    </div>
  );
}

"use client";
import { Button, ConfirmDialog, Input, KIT, KitArt, cn } from "@wonder/ui";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ImagePlus, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import { surface } from "./shared";
import { shrinkImage, uploadError } from "@/lib/shrink-image";

/**
 * Photo album (docs/photo-album.md): the pictures a creator chose to show, given room to breathe — an editorial mosaic
 * on the Profile, a full album in natural proportions, and a quiet full-screen viewer. The owner adds, captions,
 * reorders and removes; everyone else just looks. No likes, no counts.
 */
export interface AlbumItem {
  id: string;
  caption: string | null;
  width: number;
  height: number;
  src: string | null;
  thumb: string | null;
}

/** The Profile's glimpse: up to five photos, the first given the most room. */
export function AlbumPreview({ photos, href, isMe }: { photos: AlbumItem[]; href: string; isMe: boolean }) {
  if (!photos.length) {
    if (!isMe) return null;
    return (
      <Link href={href} className={cn(surface, "relative flex min-h-[92px] items-center gap-3 overflow-hidden px-3.5 py-3 hover:bg-surface-muted/60")}>
        <KitArt art={KIT.wash.washPeach} className="pointer-events-none absolute inset-y-0 right-0 h-full w-1/2 object-cover opacity-50" />
        <KitArt art={KIT.painted.coastalVignette} sizes="6rem" className="relative h-16 w-auto shrink-0" />
        <span className="relative">
          <span className="block font-display text-[17px] leading-snug text-ink">Start your album</span>
          <span className="block text-[13px] text-ink-muted">Pictures you want people to see when they visit you.</span>
        </span>
      </Link>
    );
  }
  const [hero, ...rest] = photos.slice(0, 5);
  return (
    <section aria-labelledby="album-preview-title" className={cn(surface, "overflow-hidden p-2")}>
      <div className="flex min-h-9 items-center gap-2 px-1.5 pb-1.5">
        <h2 id="album-preview-title" className="flex-1 text-[15px] font-semibold text-ink">
          Album
        </h2>
        <Link href={href} className="relative inline-flex items-center gap-0.5 text-[12.5px] font-medium text-accent-ink before:absolute before:-inset-3 before:content-[''] hover:underline">
          {isMe ? "Open album" : "See all"} <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      <Link href={href} aria-label="Open the album" className={cn("grid gap-1.5", rest.length ? "grid-cols-3 grid-rows-2" : "grid-cols-1")}>
        <Tile p={hero!} className={cn(rest.length ? "col-span-2 row-span-2 aspect-square" : "aspect-[4/3]")} sizes="(min-width: 768px) 32rem, 66vw" priority />
        {rest.slice(0, 2).map((p) => (
          <Tile key={p.id} p={p} className="aspect-square" sizes="(min-width: 768px) 16rem, 33vw" />
        ))}
      </Link>
    </section>
  );
}

function Tile({ p, className, priority }: { p: AlbumItem; className?: string; sizes?: string; priority?: boolean }) {
  return (
    <span className={cn("relative block overflow-hidden rounded-xl bg-surface-muted", className)}>
      {p.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.thumb} alt={p.caption ?? ""} loading={priority ? "eager" : "lazy"} decoding="async" className="size-full object-cover" />
      ) : null}
    </span>
  );
}

/** The full album: photos in their own proportions (masonry), captions in italic, one tap to view large. */
export function AlbumGallery({ photos: initial, isMe, name }: { photos: AlbumItem[]; isMe: boolean; name: string }) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [prev, setPrev] = useState(initial);
  if (initial !== prev) {
    setPrev(initial);
    setPhotos(initial);
  }

  async function add(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files].slice(0, 20);
    setError(null);
    setAdding({ done: 0, total: list.length });
    for (const [i, f] of list.entries()) {
      try {
        // Made small enough to send here first: phone photos are bigger than the host accepts in one request.
        const body = new FormData();
        body.set("file", await shrinkImage(f));
        const res = await fetch("/api/v1/album", { method: "POST", body });
        if (!res.ok) throw new Error(await uploadError(res, "We couldn't add that photo."));
      } catch (e) {
        setError(`${f.name}: ${errorMessage(e)}`);
      }
      setAdding({ done: i + 1, total: list.length });
    }
    setAdding(null);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {isMe ? (
        <div className="flex flex-wrap items-center gap-3">
          <input ref={input} type="file" accept="image/*" multiple className="sr-only" id="album-add" onChange={(e) => void add(e.target.files)} />
          <Button size="sm" onClick={() => input.current?.click()} loading={!!adding} aria-describedby="album-add-hint">
            <ImagePlus className="size-4" aria-hidden /> Add photos
          </Button>
          <span id="album-add-hint" role="status" className="text-[12.5px] text-ink-subtle">
            {adding ? `Adding ${Math.min(adding.done + 1, adding.total)} of ${adding.total}…` : "Up to 60 photos. Location data is removed."}
          </span>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      {photos.length ? (
        <ul aria-label={`${name}'s album`} className="columns-2 gap-2.5 sm:columns-3 [&>li]:mb-2.5">
          {photos.map((p, i) => (
            <li key={p.id} className="break-inside-avoid">
              <figure>
                <button type="button" onClick={() => setOpen(i)} className="group block w-full overflow-hidden rounded-2xl bg-surface-muted shadow-[var(--shadow-card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label={p.caption ? `View “${p.caption}”` : `View photo ${i + 1}`}>
                  {p.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumb} alt={p.caption ?? ""} width={p.width} height={p.height} loading={i < 4 ? "eager" : "lazy"} decoding="async" className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
                  ) : (
                    <span className="block aspect-[4/3]" />
                  )}
                </button>
                {p.caption ? <figcaption className="px-1 pt-1.5 font-display text-[14px] italic leading-snug text-ink-muted">{p.caption}</figcaption> : null}
              </figure>
            </li>
          ))}
        </ul>
      ) : (
        <div className={cn(surface, "relative overflow-hidden px-5 py-10 text-center")}>
          <KitArt art={KIT.wash.washLavender} className="pointer-events-none absolute inset-0 size-full object-cover opacity-40" />
          <KitArt art={KIT.painted.coastalVignette} sizes="10rem" className="relative mx-auto h-24 w-auto" />
          <p className="relative mt-3 font-display text-[20px] text-ink">{isMe ? "Your album is waiting" : "No photos yet"}</p>
          <p className="relative mx-auto mt-1 max-w-sm text-[13.5px] text-ink-muted">{isMe ? "Add the pictures you'd like people to see — places, people, light you noticed." : `${name.split(" ")[0]} hasn't added photos yet.`}</p>
        </div>
      )}
      {open !== null && photos[open] ? (
        <Viewer
          photos={photos}
          index={open}
          isMe={isMe}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onChanged={(next) => {
            setPhotos(next);
            if (!next.length) setOpen(null);
            else if (open >= next.length) setOpen(next.length - 1);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/** Full-screen, one photo at a time. Arrow keys and the side buttons move; Escape closes. */
function Viewer({ photos, index, isMe, onIndex, onClose, onChanged }: { photos: AlbumItem[]; index: number; isMe: boolean; onIndex: (i: number) => void; onClose: () => void; onChanged: (next: AlbumItem[]) => void }) {
  const p = photos[index]!;
  const closeRef = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(p.caption ?? "");
  const [seenId, setSeenId] = useState(p.id);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (seenId !== p.id) {
    setSeenId(p.id);
    setCaption(p.caption ?? "");
    setEditing(false);
    setError(null);
  }
  const go = useCallback((d: number) => onIndex((index + d + photos.length) % photos.length), [index, onIndex, photos.length]);

  useEffect(() => {
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, go, onClose]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const move = (d: -1 | 1) =>
    run(async () => {
      const next = [...photos];
      const j = index + d;
      if (j < 0 || j >= next.length) return;
      [next[index], next[j]] = [next[j]!, next[index]!];
      await api("/api/v1/album/order", { method: "POST", json: { ids: next.map((x) => x.id) } });
      onChanged(next);
      onIndex(j);
    });

  return (
    <div role="dialog" aria-modal="true" aria-label={p.caption ? `Photo: ${p.caption}` : `Photo ${index + 1} of ${photos.length}`} className="fixed inset-0 z-[60] flex flex-col bg-[#14121c]/95 text-white backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 pb-1 pt-[max(env(safe-area-inset-top),0.5rem)]">
        <p className="flex-1 text-[12.5px] tabular-nums text-white/70">
          {index + 1} / {photos.length}
        </p>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {p.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={p.src} alt={p.caption ?? ""} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl motion-safe:animate-[fade-in_160ms_ease-out]" />
        ) : null}
        {photos.length > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 hover:bg-black/50 sm:left-4">
              <ChevronLeft className="size-6" aria-hidden />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 hover:bg-black/50 sm:right-4">
              <ChevronRight className="size-6" aria-hidden />
            </button>
          </>
        ) : null}
      </div>
      <div className="mx-auto w-full max-w-2xl space-y-2 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
        {editing ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api(`/api/v1/album/${p.id}`, { method: "PATCH", json: { caption } });
                onChanged(photos.map((x) => (x.id === p.id ? { ...x, caption: caption.trim() || null } : x)));
                setEditing(false);
              });
            }}
          >
            <label htmlFor="album-caption" className="sr-only">
              Caption
            </label>
            <Input id="album-caption" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder="Say something about this picture" autoFocus className="flex-1 bg-white/95 text-ink" />
            <Button type="submit" size="sm" loading={busy}>
              Save
            </Button>
          </form>
        ) : p.caption ? (
          <p className="text-center font-display text-[17px] italic leading-snug text-white/90">{p.caption}</p>
        ) : null}
        {isMe && !editing ? (
          <div className="flex flex-wrap items-center justify-center gap-1 text-[13px] text-white/80">
            <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 hover:bg-white/10">
              <Pencil className="size-4" aria-hidden /> {p.caption ? "Edit caption" : "Add a caption"}
            </button>
            <button type="button" disabled={busy || index === 0} onClick={() => void move(-1)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 hover:bg-white/10 disabled:opacity-40">
              <ArrowLeft className="size-4" aria-hidden /> Earlier
            </button>
            <button type="button" disabled={busy || index === photos.length - 1} onClick={() => void move(1)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 hover:bg-white/10 disabled:opacity-40">
              Later <ArrowRight className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => setConfirm(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 hover:bg-white/10">
              <Trash2 className="size-4" aria-hidden /> Remove
            </button>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-center text-[13px] text-[#ffb4a8]">
            {error}
          </p>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Remove this photo from your album?"
        body="It's deleted from your album and no one will see it here again."
        confirmLabel="Remove"
        destructive
        busy={busy}
        onConfirm={() =>
          void run(async () => {
            await api(`/api/v1/album/${p.id}`, { method: "DELETE" });
            setConfirm(false);
            onChanged(photos.filter((x) => x.id !== p.id));
          })
        }
      />
    </div>
  );
}

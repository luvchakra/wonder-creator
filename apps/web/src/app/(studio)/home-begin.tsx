"use client";
import { Button, KIT, KitArt, KitPlusIcon, KitSparklesIcon, buttonClasses } from "@wonder/ui";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import type { CreationSource } from "@/components/new-creation-sheet";
import { api, errorMessage } from "@/lib/client";
import { trackClient } from "@/lib/track";
import type { HomeLatestMaterial } from "@/lib/home/payload";

// Loaded when it's first needed, like the Palette's Create.
const NewCreationSheet = dynamic(() => import("@/components/new-creation-sheet").then((m) => m.NewCreationSheet), { ssr: false });

const NOUN: Record<string, string> = {
  idea: "note",
  note: "note",
  text: "note",
  research: "note",
  inspiration: "note",
  voice: "voice note",
  image: "picture",
  sketch: "sketch",
  video: "video",
  audio: "recording",
  document: "document",
  pdf: "document",
  url: "link",
};

/**
 * Home with nothing made yet (UI redesign §8 empty state): a compact editorial card with one way to begin. Both ways open
 * the same "Make a new Creation" sheet as the Palette's Create — one place to start, not two.
 *
 * Once something has been caught (owner, 8 Oct 2026, start-small.md) it becomes the one step after catching: the newest
 * Material, in its own words, and a single "Make something" that opens the sheet with them as the first draft.
 */
export function HomeBegin({ hasMaterials, latest }: { hasMaterials: boolean; latest: HomeLatestMaterial | null }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<CreationSource | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noun = latest ? (NOUN[latest.kind] ?? "Material") : null;

  async function makeFromLatest() {
    if (!latest || busy) return;
    setBusy(true);
    setError(null);
    try {
      // The card carries a short preview; the Creation starts with all of the words.
      const r = await api<{ material: { text_content: string | null; extracted_text: string | null } }>(`/api/v1/materials/${latest.id}`);
      setSource({ materialId: latest.id, text: (r.material.text_content ?? r.material.extracted_text ?? "").trim() });
      setOpen(true);
      trackClient("home_make_from_latest");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="begin" className="overflow-hidden rounded-2xl border border-border-soft bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      {/* Vector Kit: a painted coastal vignette on a soft wash — calm, not a photo wall. */}
      <div aria-hidden className="relative flex h-32 items-end justify-center overflow-hidden bg-[linear-gradient(180deg,#fdf2e6_0%,#fbf5ee_100%)] sm:h-40">
        <KitArt art={KIT.wash.washLilacSky} className="pointer-events-none absolute -left-16 -top-24 h-56 w-auto opacity-25" />
        <KitArt art={KIT.painted.coastalVignette} sizes="(min-width: 640px) 30rem, 80vw" priority className="relative h-auto w-[80%] max-w-md" />
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        {latest ? (
          <>
            <h2 id="begin" className="font-display text-xl text-ink">
              Make something from your {noun}
            </h2>
            {latest.preview ? <p className="line-clamp-3 whitespace-pre-line font-display text-[15px] italic leading-snug text-ink-muted">{latest.preview}</p> : null}
            <Button size="sm" loading={busy} aria-haspopup="dialog" onClick={() => void makeFromLatest()}>
              <KitSparklesIcon size={16} /> Make something
            </Button>
            {error ? (
              <p role="alert" className="text-[13px] text-danger">
                {error}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h2 id="begin" className="font-display text-xl text-ink">
              What would you like to begin with?
            </h2>
            <p className="text-sm text-ink-muted">{hasMaterials ? "Your Materials are here — turn one into something, or start fresh." : "A photograph, a note, a voice memo or a single line is enough to start."}</p>
            <div className="flex flex-wrap gap-2 [&>*]:whitespace-nowrap">
              <Button size="sm" aria-haspopup="dialog" onClick={() => (setSource(null), setOpen(true))}>
                <KitSparklesIcon size={16} /> New Creation
              </Button>
              <Link href="/send" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                <KitPlusIcon size={16} /> Bring Material
              </Link>
            </div>
          </>
        )}
      </div>
      {open ? <NewCreationSheet open onOpenChange={setOpen} from={source} /> : null}
    </section>
  );
}

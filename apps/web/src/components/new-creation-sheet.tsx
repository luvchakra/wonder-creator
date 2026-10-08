"use client";
import { creationPath } from "@wonder/creator-studio/pages";
import { MODE_DEFAULT_TYPE, OUTPUT_MODES, type OutputMode } from "@wonder/creator-studio/working-set";
import { Dialog, DialogContent, KIT, KitArt } from "@wonder/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

const MODE_CHIP: Record<OutputMode, keyof typeof KIT.iconChip> = {
  writing: "type",
  carousel: "layers",
  image: "image",
  video: "video",
  audio: "waveform",
  presentation: "file",
};

/** The formats offered here: every format, now that each has its own page (owner, 5 Oct 2026: Video and Presentation back). */
const OFFERED = new Set<OutputMode>(["writing", "carousel", "image", "video", "audio", "presentation"]);

/** A Material the Creation starts from: kept as its source, and its words (a note's text, a transcript) become the first draft. */
export type CreationSource = { materialId: string; text: string };

/** What goes in one request: a first draft over this stays well inside the API's limit, even in three-byte scripts. */
const MAX_FIRST_WORDS = 150_000;

/**
 * Palette › Create (owner, 2 Oct 2026: "on click of create, show all the creation type options"): the formats at once.
 * A tap makes the Creation and opens the page built for its format (creation-pages.md). Below them, making together:
 * Collaborate with others opens a new Creative Room (owner, 4 Oct 2026). Bringing in and capturing stay one quiet line.
 *
 * From a Material (owner, 8 Oct 2026: "when i click on create it should open up 'make a creation' modal with the note as
 * initial content"): the same sheet with `from` set. The words show above the formats, the chosen Creation starts with
 * them as its first draft and records the Material as its source. Only the formats are offered then — a Room or a new
 * capture wouldn't carry the Material.
 */
export function NewCreationSheet({ open, onOpenChange, from }: { open: boolean; onOpenChange: (o: boolean) => void; from?: CreationSource | null }) {
  const words = from?.text.trim() ?? "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Make a new Creation"
        description={from ? (words ? "Choose a format to start with. These words come with it." : "Choose a format to start with. This Material comes with it as its source.") : "Choose a format to start with. You can change it later."}
        art={KIT.mark.sun}
      >
        {open ? <Body onDone={() => onOpenChange(false)} from={from ?? null} words={words} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({ onDone, from, words }: { onDone: () => void; from: CreationSource | null; words: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<OutputMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function start(mode: OutputMode) {
    setBusy(mode);
    setError(null);
    try {
      const res = await api<{ artifact: { id: string; artifact_type: string } }>("/api/v1/artifacts", {
        method: "POST",
        json: { artifactType: MODE_DEFAULT_TYPE[mode], title: "Untitled", ...(from ? { content: words.slice(0, MAX_FIRST_WORDS), materialIds: [from.materialId] } : {}) },
      });
      router.push(creationPath(res.artifact.id, res.artifact.artifact_type));
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }
  return (
    <div className="space-y-3">
      {words ? (
        <div className="rounded-2xl bg-surface-muted px-3 py-2">
          {/* The clamp sits inside the padding, so no sliver of a fourth line shows below it. */}
          <p className="line-clamp-3 whitespace-pre-line font-display text-[14px] italic leading-snug text-ink-muted">{words}</p>
        </div>
      ) : null}
      <ul className="grid grid-cols-2 gap-2" aria-label="Formats">
        {OUTPUT_MODES.filter((m) => OFFERED.has(m.key)).map((m) => (
          <li key={m.key}>
            <button
              type="button"
              disabled={busy !== null}
              aria-busy={busy === m.key}
              onClick={() => void start(m.key)}
              className="flex min-h-14 w-full items-center gap-2.5 rounded-2xl border border-border-soft bg-surface p-2.5 text-left hover:border-accent/50 hover:bg-accent-softer disabled:opacity-60"
            >
              <KitArt art={KIT.iconChip[MODE_CHIP[m.key]]} sizes="2.25rem" className="size-9 shrink-0" />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-ink">{m.label}</span>
                <span className="block truncate text-[11.5px] text-ink-subtle">{busy === m.key ? "Opening…" : m.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {/* Making together (owner, 4 Oct 2026: "in place of CreativeMind, mention collaborate with others"): a Creative Room. */}
      {from ? null : (
        <Link
          href="/rooms?new=1"
          onClick={onDone}
          className="flex min-h-12 w-full items-center gap-2.5 rounded-2xl border border-border-soft bg-surface p-2.5 text-left hover:border-accent/50 hover:bg-accent-softer"
        >
          <KitArt art={KIT.iconChip.users} sizes="2.25rem" className="size-9 shrink-0" />
          <span>
            <span className="block text-[13.5px] font-medium text-ink">Collaborate with others</span>
            <span className="block text-[11.5px] text-ink-subtle">Start a Creative Room and invite people to make it with you</span>
          </span>
        </Link>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {from ? null : (
        <p className="flex flex-wrap items-center gap-x-1 text-[13px] text-ink-muted">
          Or
          <Link href="/send" onClick={onDone} className="inline-flex min-h-11 items-center font-medium text-accent-ink underline-offset-4 hover:underline">
            bring in Material or capture something
          </Link>
        </p>
      )}
    </div>
  );
}

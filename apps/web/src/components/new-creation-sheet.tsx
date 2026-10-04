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

/**
 * Palette › Create (owner, 2 Oct 2026: "on click of create, show all the creation type options"): every format at once,
 * the same tiles as the Studio's "Make a new Creation". A tap makes the Creation and opens the page built for its format
 * (creation-pages.md: Writing has its own; the rest open the Studio until theirs arrive); "Let CreativeMind
 * decide" hands over to meTalk. Bringing in and capturing stay one quiet line below.
 */
export function NewCreationSheet({ open, onOpenChange, onMeTalk }: { open: boolean; onOpenChange: (o: boolean) => void; onMeTalk: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Make a new Creation" description="Choose a format to start with. You can change it later." art={KIT.mark.sun}>
        {open ? <Body onDone={() => onOpenChange(false)} onMeTalk={onMeTalk} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({ onDone, onMeTalk }: { onDone: () => void; onMeTalk: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<OutputMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function start(mode: OutputMode) {
    setBusy(mode);
    setError(null);
    try {
      const res = await api<{ artifact: { id: string; artifact_type: string } }>("/api/v1/artifacts", { method: "POST", json: { artifactType: MODE_DEFAULT_TYPE[mode], title: "Untitled" } });
      router.push(creationPath(res.artifact.id, res.artifact.artifact_type));
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }
  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 gap-2" aria-label="Formats">
        {OUTPUT_MODES.map((m) => (
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
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => {
          onDone();
          onMeTalk();
        }}
        className="flex min-h-12 w-full items-center gap-2.5 rounded-2xl border border-border-soft bg-surface p-2.5 text-left hover:border-accent/50 hover:bg-accent-softer disabled:opacity-60"
      >
        <KitArt art={KIT.iconChip.sparkles} sizes="2.25rem" className="size-9 shrink-0" />
        <span>
          <span className="block text-[13.5px] font-medium text-ink">Let CreativeMind decide</span>
          <span className="block text-[11.5px] text-ink-subtle">Say what you have in mind with meTalk</span>
        </span>
      </button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <p className="flex flex-wrap items-center gap-x-1 text-[13px] text-ink-muted">
        Or
        <Link href="/send" onClick={onDone} className="inline-flex min-h-11 items-center font-medium text-accent-ink underline-offset-4 hover:underline">
          bring in Material or capture something
        </Link>
      </p>
    </div>
  );
}

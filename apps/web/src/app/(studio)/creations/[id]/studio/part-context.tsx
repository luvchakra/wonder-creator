"use client";
import type { PartContext } from "@wonder/creator-projects/parts-options";
import { Button, Dialog, DialogContent, ErrorState, Field, Input, KIT, Textarea } from "@wonder/ui";
import { Layers } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { TextDiff } from "@/components/text-diff";
import { api, errorMessage } from "@/lib/client";

/**
 * A part's Creation on its own page (creative-room-parts.md, step 2): one quiet line says what this was made with and
 * what moved on since — a comparison of recorded versions, never a guess — with one way to see the change. Suggesting
 * new words for another part is a proposal its people decide on; nothing changes until they accept.
 */
export type PartOther = PartContext["others"][number];

export function PartNotice({ part, onChanges }: { part: PartContext; onChanges: (other: PartOther) => void }) {
  const moved = part.others.filter((o) => o.movedOn);
  const made = part.others.filter((o) => o.madeWith);
  const room = (
    <Link href={`/rooms/${part.project.id}`} className="inline-flex min-h-11 items-center font-medium underline">
      {part.project.title}
    </Link>
  );
  return (
    <p role="status" className="mb-2 flex items-center gap-2 rounded-2xl bg-accent-softer px-3 py-1 text-[13px] text-ink">
      <Layers className="size-4 shrink-0 text-accent" aria-hidden />
      <span className="flex-1">
        {moved.length ? (
          <>
            {list(moved.map((o) => `${o.title} moved on since this ${part.part.kind === "audio" ? "take" : "version"} (v${o.madeWith?.number ?? "?"} → v${o.current?.number ?? "?"})`))}
            {" — "}
            {moved[0]!.kind === "writing" ? (
              <button type="button" onClick={() => onChanges(moved[0]!)} aria-haspopup="dialog" className="inline-flex min-h-11 items-center font-medium underline">
                what changed
              </button>
            ) : moved[0]!.artifactId ? (
              <Link href={`/creations/${moved[0]!.artifactId}`} className="inline-flex min-h-11 items-center font-medium underline">
                open {moved[0]!.title}
              </Link>
            ) : null}
          </>
        ) : made.length ? (
          <>
            {part.part.title} in {room}, made with {list(made.map((o) => `${o.title} v${o.madeWith!.number}`))}.
          </>
        ) : (
          <>
            {part.part.title} in {room}
            {part.others.some((o) => o.current) ? <> — {list(part.others.filter((o) => o.current).map((o) => `${o.title} is at v${o.current!.number}`))}.</> : "."}
          </>
        )}
      </span>
    </p>
  );
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

type Words = { artifactId: string; title: string; current: { id: string; number: number; content: string }; from: { id: string; number: number; content: string } | null };

/** What changed in another part since this one's latest version: the lines, as the collaborators' Compare shows them. */
export function PartChangesSheet({ open, projectId, other, onOpenChange }: { open: boolean; projectId: string; other: PartOther | null; onOpenChange: (o: boolean) => void }) {
  const [words, setWords] = useState<Words | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Mounted only while open (keyed by the part), so it starts empty each time.
  useEffect(() => {
    if (!other) return;
    let live = true;
    api<{ words: Words }>(`/api/v1/projects/${projectId}/parts/${other.partId}/words${other.madeWith ? `?from=${other.madeWith.versionId}` : ""}`)
      .then((r) => live && setWords(r.words))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [other, projectId]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={other ? `${other.title}: what changed` : "What changed"} description={other?.madeWith ? `Since v${other.madeWith.number}, which this was made with; ${other.title} is at v${other.current?.number ?? "?"} now.` : undefined} art={KIT.mark.starGold} wide>
        {error ? <ErrorState body={error} /> : words ? <TextDiff from={words.from?.content ?? ""} to={words.current.content} label={`${other?.title ?? "Part"} changes`} /> : <p className="text-[13px] text-ink-muted">Reading…</p>}
      </DialogContent>
    </Dialog>
  );
}

/** New words for another part, from here: a proposal on its current version that the people on that part accept or decline. */
export function SuggestSheet({ open, projectId, other, onOpenChange }: { open: boolean; projectId: string; other: PartOther | null; onOpenChange: (o: boolean) => void }) {
  const [words, setWords] = useState<Words | null>(null);
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const textId = useId();
  const summaryId = useId();
  // Mounted only while open (keyed by the part), so it starts empty each time.
  useEffect(() => {
    if (!other) return;
    let live = true;
    api<{ words: Words }>(`/api/v1/projects/${projectId}/parts/${other.partId}/words`)
      .then((r) => {
        if (!live) return;
        setWords(r.words);
        setText(r.words.current.content);
      })
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [other, projectId]);
  async function send() {
    if (!other) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/projects/${projectId}/parts/${other.partId}/suggest`, { method: "POST", json: { content: text, summary } });
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const unchanged = !!words && text === words.current.content;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={other ? `Suggest to ${other.title}` : "Suggest"} description={sent ? undefined : `Their words as they stand${words ? ` (v${words.current.number})` : ""}. Change what you'd change; the people on ${other?.title ?? "that part"} decide.`} art={KIT.mark.starGold} wide>
        {sent ? (
          <div className="space-y-3">
            <p role="status" className="text-[14px] text-ink">
              Sent. The people on {other?.title} will see it with their words, and can take it or leave it — nothing changed yet.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            {error ? <ErrorState body={error} /> : null}
            <Field label={`${other?.title ?? "Their"} words`} htmlFor={textId}>
              <Textarea id={textId} value={text} onChange={(e) => setText(e.target.value)} rows={10} disabled={!words} className="font-serif text-[15px] leading-relaxed" />
            </Field>
            <Field label="What you'd change, in a line" hint="Goes with the suggestion." htmlFor={summaryId}>
              <Input id={summaryId} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={500} placeholder="e.g. a shorter second verse, to breathe before the chorus" required />
            </Field>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={!words || unchanged || !summary.trim()}>
                Send suggestion
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

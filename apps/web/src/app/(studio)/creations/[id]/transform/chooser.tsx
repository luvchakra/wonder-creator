"use client";
import { cn } from "@wonder/ui";
import { Clapperboard, Feather, FileText, Lightbulb, ListChecks, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TransformDialog, type TransformSource } from "../view";

export interface FormatOption {
  type: string;
  label: string;
  /** The source-specific suggestion ("Turn into lyrics"), when this form suits the source. */
  action: string | null;
  sentence: string;
  format: "prose" | "screenplay" | "verse" | "concept" | "list";
  category: string;
}

const FORMAT: Record<FormatOption["format"], { icon: LucideIcon; label: string; tint: string }> = {
  prose: { icon: FileText, label: "Prose", tint: "from-[#fde8d7] to-[#fef7f0]" },
  verse: { icon: Feather, label: "Verse · stanzas", tint: "from-[#efe7ff] to-[#fef7f0]" },
  screenplay: { icon: Clapperboard, label: "Script format", tint: "from-[#e1ecff] to-[#fef7f0]" },
  concept: { icon: Lightbulb, label: "Concept · shots, frames, cues", tint: "from-[#fff1d6] to-[#fef7f0]" },
  list: { icon: ListChecks, label: "Structured list", tint: "from-[#dcf5ee] to-[#fef7f0]" },
};

export function TransformChooser({
  artifactId,
  sourceType,
  sourceLabel,
  initialType,
  suggested,
  others,
  source,
}: {
  artifactId: string;
  sourceType: string;
  sourceLabel: string;
  initialType: string | null;
  suggested: FormatOption[];
  others: FormatOption[];
  source: TransformSource;
}) {
  const [chosen, setChosen] = useState<string | null>(initialType);
  const byCategory = others.reduce<Record<string, FormatOption[]>>((acc, o) => ({ ...acc, [o.category]: [...(acc[o.category] ?? []), o] }), {});

  const card = (o: FormatOption) => {
    const f = FORMAT[o.format];
    const Icon = f.icon;
    return (
      <li key={o.type}>
        <button
          type="button"
          onClick={() => setChosen(o.type)}
          aria-label={`${o.action ?? `Turn into ${o.label.toLowerCase()}`} — ${o.label}`}
          className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border-soft bg-surface text-left shadow-[var(--shadow-card)] transition-colors hover:border-[#cfd0ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {/* Preview: the shape of the result, not a fabricated sample. */}
          <span aria-hidden className={cn("flex h-20 items-center justify-center bg-gradient-to-br", f.tint)}>
            <Icon className="size-7 text-accent-ink/80" strokeWidth={1.5} />
          </span>
          <span className="flex flex-1 flex-col p-3.5">
            <span className="font-medium text-ink">{o.action ?? o.label}</span>
            {o.action ? <span className="text-xs text-ink-subtle">{o.label}</span> : null}
            <span className="mt-1 text-sm text-ink-muted">{o.sentence}</span>
            <span className="mt-2 text-xs text-ink-subtle">{f.label}</span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/creations/${artifactId}`} className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">
        ← {source.title}
      </Link>
      <header>
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Transform</h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          One Creation can become many forms. “{source.title}” stays as it is; what you make becomes a new Creation that remembers where it came from.
        </p>
      </header>

      {suggested.length ? (
        <section aria-labelledby="suits">
          <h2 id="suits" className="mb-2 text-lg font-semibold text-ink">
            Suits this {sourceLabel.toLowerCase()}
          </h2>
          <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">{suggested.map(card)}</ul>
        </section>
      ) : null}

      <section aria-labelledby="other-forms">
        <h2 id="other-forms" className="mb-2 text-lg font-semibold text-ink">
          Other forms
        </h2>
        <div className="space-y-2">
          {Object.entries(byCategory).map(([category, items]) => (
            <details key={category} className="rounded-2xl border border-border-soft bg-surface/70 px-4">
              <summary className="flex min-h-12 cursor-pointer items-center justify-between text-[15px] font-medium capitalize text-ink">
                {category} <span className="text-sm font-normal text-ink-subtle">{items.length}</span>
              </summary>
              <ul className="grid grid-cols-1 gap-3 pb-4 min-[420px]:grid-cols-2">{items.map(card)}</ul>
            </details>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-muted">
          Making something for a specific place — a YouTube description, a post, a thumbnail?{" "}
          <Link href={`/creations/${artifactId}/derivatives`} className="font-medium text-accent-ink hover:underline">
            Create for a destination
          </Link>
        </p>
      </section>

      {chosen ? <TransformDialog key={chosen} open focused onOpenChange={(o) => !o && setChosen(null)} artifactId={artifactId} currentType={sourceType} initialType={chosen} source={source} /> : null}
    </div>
  );
}

"use client";
import { Field, Segmented, Select, cn } from "@wonder/ui";
import Link from "next/link";
import { useMemo, useState } from "react";
import { diffLines } from "@/lib/diff";

interface V {
  id: string;
  number: number;
  label: string;
  content: string;
  summary: string | null;
  createdAt: string;
}
type Mode = "single" | "before-after" | "swipe";

export function CompareView({ artifact, versions, currentId, initialA, initialB }: { artifact: { id: string; title: string; format: string }; versions: V[]; currentId: string | null; initialA: string; initialB: string }) {
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [mode, setMode] = useState<Mode>("single");
  const before = versions.find((v) => v.id === a)!;
  const after = versions.find((v) => v.id === b)!;
  const diff = useMemo(() => (before.id !== after.id ? diffLines(before.content, after.content) : null), [before, after]);
  const counts = diff ? { added: diff.filter((d) => d.kind === "added").length, removed: diff.filter((d) => d.kind === "removed").length } : null;
  const font = artifact.format === "screenplay" ? "font-mono text-[13.5px] leading-7" : "font-display text-[17px] leading-8";
  const name = (v: V) => `v${v.number} ${v.label}${v.id === currentId ? " (current)" : ""}`;

  const page = (v: V, label: string) => (
    <article aria-label={`${label}: v${v.number}`} className="flex min-w-0 flex-col rounded-2xl border border-border-soft bg-surface">
      <header className="border-b border-border-soft px-4 py-2.5">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-subtle">{label}</p>
        <p className="text-sm font-medium text-ink">{name(v)}</p>
      </header>
      <div className={cn("max-h-[60vh] overflow-auto whitespace-pre-wrap px-4 py-4 text-ink sm:px-6", font)}>{v.content || "Empty."}</div>
    </article>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href={`/creations/${artifact.id}?tab=versions`} className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">
        ← {artifact.title}
      </Link>
      <header>
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Compare versions</h1>
        <p className="mt-1 text-[15px] text-ink-muted">Nothing here changes a version. Restoring an older one adds a new version, so history stays whole.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
        <Field label="Before" htmlFor="cmp-a">
          <Select id="cmp-a" value={a} onChange={(e) => setA(e.target.value)}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {name(v)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="After" htmlFor="cmp-b">
          <Select id="cmp-b" value={b} onChange={(e) => setB(e.target.value)}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {name(v)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Mode>
          label="Compare as"
          value={mode}
          onChange={setMode}
          options={[
            { value: "single", label: "Single view" },
            { value: "before-after", label: "Before / After" },
            { value: "swipe", label: "Swipe" },
          ]}
        />
        {counts ? (
          <p className="text-sm text-ink-muted" aria-live="polite">
            {counts.added} {counts.added === 1 ? "line" : "lines"} added · {counts.removed} removed
          </p>
        ) : null}
      </div>

      {!diff ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface/60 px-5 py-6 text-center text-ink-muted">Choose two different versions to compare.</p>
      ) : mode === "single" ? (
        <section aria-label="Changes" className="max-h-[65vh] overflow-auto rounded-2xl bg-surface-muted p-3 font-mono text-[13px] leading-relaxed sm:p-4">
          {diff.map((d, i) => (
            <div key={i} className={cn("whitespace-pre-wrap px-2", d.kind === "added" && "bg-success-soft text-success-ink", d.kind === "removed" && "bg-danger-soft text-danger line-through decoration-danger/40")}>
              <span aria-hidden className="mr-2 select-none opacity-60">
                {d.kind === "added" ? "+" : d.kind === "removed" ? "−" : " "}
              </span>
              <span className="sr-only">{d.kind === "added" ? "Added: " : d.kind === "removed" ? "Removed: " : ""}</span>
              {d.text || " "}
            </div>
          ))}
        </section>
      ) : mode === "before-after" ? (
        // Stacked on phones, side by side only when there's room.
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {page(before, "Before")}
          {page(after, "After")}
        </div>
      ) : (
        <section aria-label="Swipe between before and after">
          <p className="mb-2 text-sm text-ink-muted">Swipe (or scroll) sideways to move between them.</p>
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            <li className="w-[88%] shrink-0 snap-center sm:w-[70%]">{page(before, "Before")}</li>
            <li className="w-[88%] shrink-0 snap-center sm:w-[70%]">{page(after, "After")}</li>
          </ul>
        </section>
      )}

      {after.summary ? (
        <p className="text-sm text-ink-muted">
          <span className="font-medium text-ink">What changed in v{after.number}:</span> {after.summary}
        </p>
      ) : null}
    </div>
  );
}

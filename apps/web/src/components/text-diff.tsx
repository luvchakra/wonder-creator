import { cn } from "@wonder/ui";
import { diffLines } from "@/lib/diff";

/** Two texts, line by line: what was added and what went. Colour is never the only signal (a sign and a spoken label). */
export function TextDiff({ from, to, label = "Changes", className }: { from: string; to: string; label?: string; className?: string }) {
  const lines = diffLines(from, to);
  return (
    <pre aria-label={label} className={cn("max-h-[45dvh] overflow-auto whitespace-pre-wrap rounded-xl border border-border-soft bg-cream p-3 text-sm leading-relaxed", className)}>
      {lines.map((l, i) => (
        <div key={i} className={cn(l.kind === "added" && "bg-[#e7f6ec] text-ink", l.kind === "removed" && "bg-[#fdecec] text-ink-muted line-through")}>
          <span aria-hidden className="mr-2 inline-block w-3 select-none text-ink-subtle">
            {l.kind === "added" ? "+" : l.kind === "removed" ? "−" : " "}
          </span>
          <span className="sr-only">{l.kind === "added" ? "Added: " : l.kind === "removed" ? "Removed: " : ""}</span>
          {l.text || " "}
        </div>
      ))}
    </pre>
  );
}

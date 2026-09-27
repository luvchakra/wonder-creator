"use client";
import * as React from "react";
import { cn } from "../cn";
import { chipBase } from "./chip";

/**
 * A small segmented switch for views of the same thing (Changes · Original · Proposed, Before/After · Single…).
 * A radio group: one tab stop, arrow keys move the choice; compact 32px segments inside 44px targets.
 */
export function Segmented<T extends string>({ label, value, options, onChange, className }: { label: string; value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (v: T) => void; className?: string }) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const move = (i: number) => {
    const next = options[(i + options.length) % options.length]!;
    onChange(next.value);
    refs.current[(i + options.length) % options.length]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-surface p-0.5 py-1.5 shadow-[0_3px_12px_-4px_rgb(107_91_149/0.16)] [scrollbar-width:none]", className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(i + 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(i - 1);
              }
            }}
            className={cn(
              chipBase,
              "font-medium transition-colors motion-reduce:transition-none",
              // Vector Kit segmented tab: the chosen segment is a filled violet pill.
              on ? "bg-[image:var(--gradient-primary)] text-white shadow-[var(--shadow-glow)]" : "text-accent-ink hover:bg-accent-softer",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

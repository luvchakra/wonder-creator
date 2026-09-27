"use client";
import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import * as React from "react";
import { cn } from "../cn";
import { Watercolor } from "./brand";

export interface PaletteItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  /** Short hint shown under the label (optional). */
  hint?: string;
  current?: boolean;
  onSelect: () => void;
}

export interface PaletteGroup {
  key: string;
  /** Visible group label (e.g. "This Creation"); omitted for the main destinations. */
  label?: string;
  items: PaletteItem[];
}

/**
 * The Creative Palette: the corner control that replaces bottom navigation. A thumb-reachable trigger (the watercolor palette motif) in the lower
 * right (safe-area aware) opens a fan of menu "leaves" — destinations, quick actions and whatever the current screen
 * offers. It traps focus, closes on Escape, outside tap or the trigger, and respects reduced motion.
 */
export function Palette({ groups, open, onOpenChange, className }: { groups: PaletteGroup[]; open: boolean; onOpenChange: (open: boolean) => void; className?: string }) {
  let index = 0;
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  // Leaves arc away from the corner: the ones nearest the trigger sit furthest right.
  const inset = (i: number) => (total > 1 ? Math.sin(((total - 1 - i) / (total - 1)) * (Math.PI / 2)) * 2.25 : 0);
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Trigger
        aria-label={open ? "Close Creative Palette" : "Open Creative Palette"}
        className={cn(
          "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))] z-40 inline-flex size-[3.75rem] items-center justify-center rounded-full",
          "border border-border-soft bg-surface text-accent shadow-[var(--shadow-lift)] transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none",
          open && "z-[55]",
          className,
        )}
      >
        {/* The owner-supplied watercolor palette motif; the trigger keeps its label for assistive tech. */}
        {open ? <X className="size-6 text-ink" aria-hidden /> : <Watercolor name="paletteMotif" sizes="2.75rem" priority className="h-auto w-[2.75rem]" />}
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[45] bg-cream/55 backdrop-blur-[3px] motion-safe:data-[state=open]:animate-[fade-in_180ms_ease-out]" />
        <D.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // Focus the first leaf rather than the container.
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>("[data-palette-item]")?.focus();
          }}
          className={cn(
            "fixed z-50 flex max-h-[calc(100dvh-8rem)] w-[min(19rem,calc(100vw-2rem))] flex-col items-end overflow-y-auto overscroll-contain focus:outline-none",
            "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))] pb-1",
          )}
        >
          <D.Title className="sr-only">Creative Palette</D.Title>
          <p className="sr-only" aria-live="polite">
            Creative Palette opened
          </p>
          {groups.map((g, gi) => (
            <nav key={g.key} aria-label={g.label ?? "Destinations"} className={cn("flex w-full flex-col items-end gap-1.5", gi > 0 && "mt-3 border-t border-border-soft/80 pt-3")}>
              {g.label ? <p className="mr-3 text-xs font-medium uppercase tracking-[0.12em] text-ink-subtle">{g.label}</p> : null}
              <ul className="flex w-full flex-col items-end gap-1.5">
                {g.items.map((item) => {
                  const i = index++;
                  return (
                    <li key={item.key} className="w-full" style={{ paddingRight: `${inset(i).toFixed(2)}rem` }}>
                      <button
                        type="button"
                        data-palette-item
                        aria-current={item.current ? "page" : undefined}
                        onClick={() => {
                          onOpenChange(false);
                          item.onSelect();
                        }}
                        style={{ animationDelay: `${i * 25}ms` }}
                        className={cn(
                          "ml-auto flex min-h-12 w-full max-w-[17rem] items-center gap-3 rounded-full border px-4 text-left shadow-[var(--shadow-card)] transition-colors",
                          "motion-safe:animate-[palette-leaf_260ms_cubic-bezier(0.2,0.9,0.3,1.05)_both]",
                          item.current ? "border-accent/40 bg-accent-soft text-accent-ink" : "border-border-soft bg-surface text-ink hover:bg-accent-softer",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                        )}
                      >
                        {item.icon ? <span className="inline-flex size-6 shrink-0 items-center justify-center text-accent">{item.icon}</span> : null}
                        <span className="min-w-0">
                          <span className="block text-[15px] font-medium">{item.label}</span>
                          {item.hint ? <span className="block truncate text-xs text-ink-muted">{item.hint}</span> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

"use client";
import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import * as React from "react";
import { cn } from "../cn";
import { KIT } from "../brand/kit";

/** How far (rem) the leaf beside the trigger sits from the corner. Leaves stay horizontal (owner's direction). */
const FAN_REACH = 4.5;

export interface PaletteItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  /** Short hint shown under the label (optional). */
  hint?: string;
  current?: boolean;
  /** Opens a sub-view (More…, Go to…, Create) instead of acting, so the Palette stays open. */
  keepOpen?: boolean;
  /** Visually quieter (More…, Go to…, Back). */
  quiet?: boolean;
  onSelect: () => void;
}

export interface PaletteGroup {
  key: string;
  /** Visible group label (e.g. "This Creation"); omitted for the main destinations. */
  label?: string;
  /** Accessible name when there's no visible label. */
  srLabel?: string;
  items: PaletteItem[];
}

/**
 * The Creative Palette: the corner control that replaces bottom navigation. A thumb-reachable trigger (the Vector Kit palette button) in the lower
 * right (safe-area aware) opens a fan of menu "leaves" on an arc around it — destinations, quick actions and whatever
 * the current screen offers. It traps focus, closes on Escape, outside tap or the trigger, and respects reduced motion.
 */
export function Palette({ groups, open, onOpenChange, className, announce }: { groups: PaletteGroup[]; open: boolean; onOpenChange: (open: boolean) => void; className?: string; announce?: string }) {
  // Switching views (More…, Go to…, Create) keeps focus inside, on the first new action.
  const contentRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (open) contentRef.current?.querySelector<HTMLElement>("[data-palette-item]")?.focus();
  }, [open, announce]);
  let index = 0;
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  // The fan (CLAUDE.md → Creative Palette): leaves sit on a quarter-arc around the trigger. The leaf nearest the trigger
  // sits beside it, the furthest right above it. Leaves stay level. Labels stay horizontal enough to read.
  const reach = (i: number) => (total > 1 ? (total - 1 - i) / (total - 1) : 0); // 0 = beside the trigger, 1 = above it
  const inset = (i: number) => FAN_REACH * Math.cos(reach(i) * (Math.PI / 2));
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Trigger
        aria-label={open ? "Close Creative Palette" : "Open Creative Palette"}
        className={cn(
          "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))] z-40 inline-flex size-[3.75rem] items-center justify-center rounded-full",
          // No disc behind the painted palette (owner's request): the artwork is the button. The close state keeps a small
          // surface so the X stays legible over the dimmed page.
          "text-accent transition-transform hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none",
          open && "z-[55] border border-border-soft bg-surface shadow-[var(--shadow-lift)]",
          className,
        )}
      >
        {/* The Vector Kit's painter's-palette button; the trigger keeps its label for assistive tech. */}
        {open ? (
          <X className="size-6 text-ink" aria-hidden />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={KIT.paletteButton.svg} alt="" aria-hidden width={56} height={56} fetchPriority="high" draggable={false} className="size-14 select-none drop-shadow-[0_4px_10px_rgb(107_91_149/0.28)]" />
        )}
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[45] bg-cream/55 backdrop-blur-[3px] motion-safe:data-[state=open]:animate-[fade-in_180ms_ease-out]" />
        <D.Content
          ref={contentRef}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // Focus the first leaf rather than the container.
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>("[data-palette-item]")?.focus();
          }}
          className={cn(
            "fixed z-50 flex max-h-[calc(100dvh-var(--nav-height)-2.5rem)] w-[min(20rem,calc(100vw-2rem))] flex-col items-end overflow-y-auto overscroll-contain focus:outline-none",
            // The fan's lowest leaf lines up with the trigger's centre, beside it.
            "bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))] pt-3",
          )}
        >
          <D.Title className="sr-only">Creative Palette</D.Title>
          <p className="sr-only" aria-live="polite">
            {announce ?? "Creative Palette opened"}
          </p>
          {groups.map((g, gi) => (
            <nav key={g.key} aria-label={g.label ?? g.srLabel ?? "Destinations"} className={cn("flex w-full flex-col items-end", gi > 0 && "mt-1")}>
              {g.label ? (
                <p className="mb-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle" style={{ marginRight: `${(inset(index) + 0.75).toFixed(2)}rem` }}>
                  {g.label}
                </p>
              ) : null}
              <ul className="flex w-full flex-col items-end">
                {g.items.map((item) => {
                  const i = index++;
                  return (
                    <li key={item.key} className="flex w-full justify-end" style={{ paddingRight: `${inset(i).toFixed(2)}rem` }}>
                      <button
                        type="button"
                        data-palette-item
                        aria-current={item.current ? "page" : undefined}
                        onClick={() => {
                          if (!item.keepOpen) onOpenChange(false);
                          item.onSelect();
                        }}
                        // Palette reveal (interaction-minimalism §6.3): a soft fan with minimal stagger, finished within 280ms.
                        style={{ animationDelay: `${Math.min(i * 10, 80)}ms` }}
                        className={cn(
                          // Compact (density spec §15): a 36–40px leaf inside a 44px hit target.
                          "group flex min-h-11 max-w-[16rem] origin-bottom-right items-center rounded-full text-left focus-visible:outline-none",
                          // Opens as a fan from the trigger (minimalism §6.3: 200–280ms, minimal stagger).
                          "motion-safe:animate-[palette-leaf_220ms_cubic-bezier(0.2,0.8,0.3,1)_both]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex min-h-[38px] items-center gap-2.5 rounded-full border py-1 pl-3 pr-4 shadow-[var(--shadow-card)] transition-colors",
                            item.current ? "border-accent/40 bg-accent-soft text-accent-ink" : item.quiet ? "border-transparent bg-surface/85 text-ink-muted group-hover:bg-accent-softer" : "border-border-soft bg-surface text-ink group-hover:bg-accent-softer",
                            "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent",
                          )}
                        >
                          {item.icon ? <span className="inline-flex size-5 shrink-0 items-center justify-center text-accent">{item.icon}</span> : null}
                          <span className="min-w-0">
                            <span className="block text-sm font-medium leading-tight">{item.label}</span>
                            {item.hint ? <span className="block truncate text-xs leading-tight text-ink-muted">{item.hint}</span> : null}
                          </span>
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

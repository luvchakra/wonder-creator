"use client";
import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import * as React from "react";
import { cn } from "../cn";
import { KIT } from "../brand/kit";
import { dockStyle, useEdgeDock } from "./edge-dock";

/** How far (rem) the leaf beside the trigger sits from the edge. Leaves stay horizontal (owner's direction). */
const FAN_REACH = 4.5;
const TRIGGER = 60;
/** Half a leaf's hit target: the leaf beside the trigger lines up with the trigger's centre. */
const LEAF_HALF = 22;

const navBottom = () => (typeof document === "undefined" ? 64 : (document.querySelector("header")?.getBoundingClientRect().bottom ?? 64));

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
 * The Creative Palette: the control that replaces bottom navigation. A thumb-reachable trigger (the Vector Kit palette
 * button), in the lower right by default, opens a fan of menu "leaves" on an arc around it — destinations, quick actions
 * and whatever the current screen offers. The creator can drag the trigger anywhere; it settles against the nearest left
 * or right edge and stays there (`useEdgeDock`), and the fan mirrors to that side and opens downward when the trigger is
 * high on the screen. It traps focus, closes on Escape, outside tap or the trigger, and respects reduced motion.
 */
export function Palette({ groups, open, onOpenChange, className, announce }: { groups: PaletteGroup[]; open: boolean; onOpenChange: (open: boolean) => void; className?: string; announce?: string }) {
  // Switching views (More…, Go to…, Create) keeps focus inside, on the first new action.
  const contentRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (open) contentRef.current?.querySelector<HTMLElement>("[data-palette-item]")?.focus();
  }, [open, announce]);
  const dock = useEdgeDock("wc.palette.dock", {
    height: TRIGGER,
    defaultY: (vh) => vh - 16 - TRIGGER / 2,
    bounds: (vh) => ({ min: navBottom() + 8 + TRIGGER / 2, max: vh - 12 - TRIGGER / 2 }),
  });
  const left = dock.pos?.side === "left";
  // Opens upward from a low trigger (the default) and downward from a high one, so the fan always has room.
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const anchorY = dock.pos?.y ?? vh - 16 - TRIGGER / 2;
  const down = anchorY < vh * 0.42;
  let index = 0;
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  // The fan (CLAUDE.md → Creative Palette): leaves sit on a quarter-arc around the trigger. The leaf nearest the trigger
  // sits beside it, the furthest right above (or below) it. Leaves stay level. Labels stay horizontal enough to read.
  const reach = (i: number) => (total > 1 ? (down ? i : total - 1 - i) / (total - 1) : 0); // 0 = beside the trigger, 1 = above/below it
  const inset = (i: number) => FAN_REACH * Math.cos(reach(i) * (Math.PI / 2));
  const edge = left ? "calc(1rem + env(safe-area-inset-left))" : "calc(1rem + env(safe-area-inset-right))";
  const contentStyle: React.CSSProperties = {
    [left ? "left" : "right"]: edge,
    ...(down
      ? { top: anchorY - LEAF_HALF, maxHeight: `calc(100dvh - ${Math.round(anchorY - LEAF_HALF)}px - 1rem)` }
      : { bottom: `calc(100dvh - ${Math.round(anchorY + LEAF_HALF)}px)`, maxHeight: Math.max(160, anchorY + LEAF_HALF - navBottom() - 12) }),
    // The leaf fan-in comes from the trigger's side (globals.css `palette-leaf`).
    ["--fan-dx" as string]: left ? "-0.75rem" : "0.75rem",
    ["--fan-dy" as string]: down ? "-0.5rem" : "0.5rem",
  };
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Trigger
        aria-label="Open Creative Palette"
        aria-describedby="palette-move-hint"
        data-palette-trigger=""
        data-dock-side={dock.pos?.side ?? "right"}
        {...(open ? {} : dock.handlers)}
        onClick={(e) => {
          // A drag that ends on the trigger isn't a tap.
          if (dock.consumeClick()) e.preventDefault();
        }}
        style={dockStyle(dock, { w: TRIGGER, h: TRIGGER }, edge)}
        className={cn(
          "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))] z-40 inline-flex size-[3.75rem] items-center justify-center rounded-full",
          // No disc behind the painted palette (owner's request): the artwork is the button.
          "cursor-grab select-none text-accent transition-transform hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:cursor-grabbing motion-reduce:transition-none",
          // While open, the X inside the Palette takes its place (the open dialog makes the page, trigger included, inert).
          open && "invisible",
          className,
        )}
      >
        {/* The Vector Kit's painter's-palette button; the trigger keeps its label for assistive tech. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={KIT.paletteButton.svg} alt="" aria-hidden width={56} height={56} fetchPriority="high" draggable={false} className="size-14 select-none drop-shadow-[0_4px_10px_rgb(107_91_149/0.28)]" />
      </D.Trigger>
      <span id="palette-move-hint" hidden>
        Drag it, or press Shift with the arrow keys, to move it to either side.
      </span>
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
          style={contentStyle}
          className={cn(
            // The leaf beside the trigger lines up with the trigger's centre.
            "fixed z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col overflow-y-auto overflow-x-hidden overscroll-contain focus:outline-none",
            left ? "items-start" : "items-end",
            down ? "pb-3" : "pt-3",
          )}
        >
          <D.Title className="sr-only">Creative Palette</D.Title>
          {/* The close X sits exactly where the trigger is. It lives inside the dialog, so it always takes a tap and
              keyboard focus (a control outside a modal dialog is inert). A small surface keeps it legible over the dim. */}
          <D.Close
            aria-label="Close Creative Palette"
            style={dockStyle({ ...dock, drag: null }, { w: TRIGGER, h: TRIGGER }, edge)}
            className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))] z-[55] order-last inline-flex size-[3.75rem] items-center justify-center rounded-full border border-border-soft bg-surface text-ink shadow-[var(--shadow-lift)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X className="size-6" aria-hidden />
          </D.Close>
          <p className="sr-only" aria-live="polite">
            {announce ?? "Creative Palette opened"}
          </p>
          {groups.map((g, gi) => (
            <nav key={g.key} aria-label={g.label ?? g.srLabel ?? "Destinations"} className={cn("flex w-full flex-col", left ? "items-start" : "items-end", gi > 0 && "mt-1")}>
              {g.label ? (
                <p className="mb-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle" style={{ [left ? "marginLeft" : "marginRight"]: `${(inset(index) + 0.75).toFixed(2)}rem` }}>
                  {g.label}
                </p>
              ) : null}
              <ul className={cn("flex w-full flex-col", left ? "items-start" : "items-end")}>
                {g.items.map((item) => {
                  const i = index++;
                  return (
                    <li key={item.key} className={cn("flex w-full", left ? "justify-start" : "justify-end")} style={{ [left ? "paddingLeft" : "paddingRight"]: `${inset(i).toFixed(2)}rem` }}>
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
                          "group flex min-h-11 min-w-0 max-w-[min(16rem,100%)] items-center rounded-full text-left focus-visible:outline-none",
                          down ? (left ? "origin-top-left" : "origin-top-right") : left ? "origin-bottom-left" : "origin-bottom-right",
                          // Opens as a fan from the trigger (minimalism §6.3: 200–280ms, minimal stagger).
                          "motion-safe:animate-[palette-leaf_220ms_cubic-bezier(0.2,0.8,0.3,1)_both]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex min-h-[38px] min-w-0 items-center gap-2.5 rounded-full border py-1 pl-3 pr-4 shadow-[var(--shadow-card)] transition-colors",
                            item.current ? "border-accent/40 bg-accent-soft text-accent-ink" : item.quiet ? "border-transparent bg-surface/85 text-ink-muted group-hover:bg-accent-softer" : "border-border-soft bg-surface text-ink group-hover:bg-accent-softer",
                            "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent",
                          )}
                        >
                          {item.icon ? <span className="inline-flex size-5 shrink-0 items-center justify-center text-accent">{item.icon}</span> : null}
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium leading-tight">{item.label}</span>
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

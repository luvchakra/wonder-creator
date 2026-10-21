import { KIT, KitArt } from "@wonder/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

/**
 * Two doors under the greeting (owner, 21 Oct 2026: "only keep My Captures and My Scrapbook links"): what you caught and
 * what you wrote in the Scrapbook, each one tap away. Home no longer shows their contents, so it asks nothing for them.
 */
const DOORS = [
  { href: "/captures", title: "My captures", hint: "Notes and voice notes", art: KIT.iconChip.layers },
  { href: "/scrapbook", title: "My Scrapbook", hint: "Thoughts, written down", art: KIT.iconChip.book },
] as const;

export function HomeDoors() {
  return (
    <nav aria-label="Your captures and Scrapbook" className="grid grid-cols-2 gap-2.5">
      {DOORS.map((d) => (
        <Link
          key={d.href}
          href={d.href}
          className="group flex min-h-14 items-center gap-2.5 rounded-2xl border border-border-soft bg-surface/85 px-3 py-2 shadow-[var(--shadow-card)] backdrop-blur-[2px] hover:bg-surface"
        >
          <KitArt art={d.art} sizes="2.25rem" className="size-9 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-[16px] leading-snug text-ink">{d.title}</span>
            <span className="block truncate text-[12px] text-ink-muted">{d.hint}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        </Link>
      ))}
    </nav>
  );
}

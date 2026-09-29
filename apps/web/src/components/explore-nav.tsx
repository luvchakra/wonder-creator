import { cn } from "@wonder/ui";
import Link from "next/link";
import { flagOn } from "@/lib/features";

/**
 * Explore's four doors (Phase 03 §2): Ideas · Materials · People · Community. Community lives here rather than as a new
 * permanent destination; the Palette's Explore opens this set.
 */
const DOORS = [
  { key: "ideas", label: "Ideas", href: "/search" },
  { key: "materials", label: "Materials", href: "/search?type=material" },
  { key: "people", label: "People", href: "/discover" },
  { key: "community", label: "Community", href: "/community" },
] as const;

export function ExploreNav({ current }: { current: (typeof DOORS)[number]["key"] }) {
  return (
    <nav aria-label="Explore" className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {DOORS.filter((d) => d.key !== "community" || flagOn("community_enabled")).map((d) => (
        <Link key={d.key} href={d.href} aria-current={current === d.key ? "page" : undefined} className="inline-flex min-h-11 shrink-0 items-center">
          <span className={cn("inline-flex h-8 items-center rounded-full px-3.5 text-[13.5px] font-medium", current === d.key ? "bg-ink text-white" : "text-ink-muted hover:bg-surface-muted hover:text-ink")}>{d.label}</span>
        </Link>
      ))}
    </nav>
  );
}

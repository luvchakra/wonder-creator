import { ChevronRight } from "lucide-react";
import Link from "next/link";

/**
 * A Home section's title, which is also the way to everything in it (owner, 4 Oct 2026: "reduce the number of buttons"):
 * "My Scrapbook ›" instead of a title plus an "All scraps" row.
 */
export function SectionTitle({ id, href, children }: { id: string; href: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="flex min-h-11 items-center text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
      <Link href={href} className="-mx-1 inline-flex min-h-11 items-center gap-0.5 rounded-md px-1 hover:text-ink">
        {children}
        <ChevronRight className="size-3.5" aria-hidden />
      </Link>
    </h2>
  );
}

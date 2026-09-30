import { cn } from "@wonder/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** One flat Profile surface (compact-density §5): 10–12px padding, no card-inside-card. */
export const surface = "rounded-2xl border border-border-soft bg-surface shadow-[var(--shadow-card)]";

export function SectionHead({ icon, title, href, linkLabel = "See all" }: { icon?: ReactNode; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex min-h-9 items-center gap-2">
      {icon ? <span className="text-accent-ink">{icon}</span> : null}
      <h2 className="flex-1 text-[15px] font-semibold text-ink">{title}</h2>
      {href ? (
        <Link href={href} className="relative inline-flex items-center gap-0.5 text-[12.5px] font-medium text-accent-ink before:absolute before:-inset-3 before:content-[''] hover:underline">
          {linkLabel} <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-6 items-center rounded-full bg-surface-muted px-2.5 text-[12px] text-ink-muted", className)}>{children}</span>;
}

/** A small, soft waveform for audio pieces and notes (decorative). */
export function Waveform({ className }: { className?: string }) {
  const bars = [5, 9, 14, 8, 18, 11, 21, 9, 15, 6, 19, 12, 8, 16, 10, 5, 13, 20, 9, 6, 12, 17, 7, 11];
  return (
    <span aria-hidden className={cn("flex h-8 min-w-0 flex-1 items-center gap-[2px] overflow-hidden", className)}>
      {bars.map((h, i) => (
        <span key={i} className="w-[2.5px] shrink-0 rounded-full bg-lavender" style={{ height: h * 1.3 }} />
      ))}
    </span>
  );
}

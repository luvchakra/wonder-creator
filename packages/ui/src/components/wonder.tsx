import { Sparkles } from "lucide-react";
import * as React from "react";
import { cn } from "../cn";

/**
 * CreativeMind appears in context, never as a chat (UI redesign §2.2, §43). The label says honestly what this is:
 * an "insight" is something CreativeMind actually produced; "noticed" is a plain fact the app observed; "waiting"
 * is CreativeMind asking for the creator's OK.
 */
export function CreativeMindInsight({
  kind = "insight",
  children,
  action,
  className,
}: {
  kind?: "insight" | "noticed" | "waiting";
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const label = kind === "insight" ? "CreativeMind insight" : kind === "waiting" ? "CreativeMind is waiting for you" : "Wonder noticed";
  return (
    <section aria-label={label} className={cn("rounded-2xl border border-[#dcd6ff] bg-[linear-gradient(135deg,#f5f3ff_0%,#fff_70%)] px-4 py-3.5 shadow-[var(--shadow-card)]", className)}>
      <p className="flex items-center gap-1.5 text-sm font-medium text-accent-ink">
        <Sparkles className="size-4" aria-hidden /> {label}
      </p>
      <div className="mt-1 text-[15px] leading-relaxed text-ink">{children}</div>
      {action ? <div className="mt-2">{action}</div> : null}
    </section>
  );
}

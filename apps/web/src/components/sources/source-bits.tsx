import type { Provider } from "@wonder/creator-sources";
import { KIT, KitArt, cn } from "@wonder/ui";
import { CalendarDays, FileText, Images, Mail, NotebookPen } from "lucide-react";

const ICON: Record<Provider, { icon: React.ComponentType<{ className?: string }>; wash: keyof typeof KIT.wash; tint: string }> = {
  gmail: { icon: Mail, wash: "washRose", tint: "text-[#c2410c]" },
  google_calendar: { icon: CalendarDays, wash: "washLilacSky", tint: "text-[#4f46e5]" },
  native_notes: { icon: NotebookPen, wash: "washPeach", tint: "text-[#b45309]" },
  external_notes: { icon: FileText, wash: "washCream", tint: "text-ink" },
  phone_photos: { icon: Images, wash: "washMint", tint: "text-[#047857]" },
  cloud_photos: { icon: Images, wash: "washSage", tint: "text-[#047857]" },
};

/** A source's mark: a generic icon on a painted wash (never a provider's logo). */
export function SourceIcon({ provider, className }: { provider: Provider; className?: string }) {
  const { icon: Icon, wash, tint } = ICON[provider];
  return (
    <span className={cn("relative isolate inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-muted", className)}>
      <KitArt art={KIT.wash[wash]} sizes="3rem" className="absolute inset-0 -z-10 size-full scale-150 object-cover opacity-90" />
      <Icon className={cn("size-5", tint)} aria-hidden />
    </span>
  );
}

/** What a sync is doing, in words (spec §4: phases, never a made-up percentage). */
export function phaseText(provider: Provider, status: string, phase: string): string {
  const what = provider === "native_notes" ? "notes" : provider === "gmail" ? "emails" : provider === "google_calendar" ? "events" : "photos";
  if (status === "queued") return "Waiting to start…";
  if (status === "paused") return phase === "rate_limited" ? "Paused — the provider asked us to wait" : phase === "retrying" ? "Trying again shortly…" : "Continuing shortly…";
  if (phase === "grouping") return "Finding what's worth exploring…";
  return `Checking for new ${what}…`;
}

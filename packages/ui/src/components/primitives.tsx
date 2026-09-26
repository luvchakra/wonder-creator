import { AlertCircle, RotateCcw } from "lucide-react";
import * as React from "react";
import { cn } from "../cn";

export function Card({ className, as: As = "div", ...props }: React.HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" | "li" }) {
  return <As className={cn("rounded-2xl border border-border-soft bg-surface shadow-[var(--shadow-card)]", className)} {...props} />;
}

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "live" }) {
  const t = {
    neutral: "bg-[#f3efe9] text-ink-muted",
    accent: "bg-accent-soft text-accent-ink",
    success: "bg-success-soft text-success-ink",
    warning: "bg-warning-soft text-warning-ink",
    danger: "bg-danger-soft text-danger",
    live: "bg-live text-white",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", t, className)} {...props} />;
}

export function LiveBadge({ className, label = "Live" }: { className?: string; label?: string }) {
  return (
    <Badge tone="live" className={cn("gap-1.5 uppercase tracking-wide", className)}>
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inline-flex size-full rounded-full bg-white/80 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-white" />
      </span>
      {label}
    </Badge>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rounded-xl bg-[#efe8df] motion-safe:animate-pulse", className)} />;
}

export function Spinner({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-sm text-ink-subtle", className)}>
      <span className="size-4 rounded-full border-2 border-accent/30 border-t-accent motion-safe:animate-spin" aria-hidden />
      <span>{label}</span>
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
  image,
  className,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  image?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border-soft bg-surface px-6 py-10 text-center", className)}>
      {image ? (
        // Supplied brand background, faint, decorative only.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full object-cover opacity-[0.18]" />
      ) : null}
      <div className="relative mx-auto max-w-md">
        <h3 className="font-display text-xl text-ink">{title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{body}</p>
        {action ? <div className="mt-5 flex justify-center gap-3">{action}</div> : null}
      </div>
    </div>
  );
}

export function ErrorState({ title = "Something didn't load", body, onRetry, className }: { title?: string; body: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex items-start gap-3 rounded-2xl border border-[#f5d0d0] bg-danger-soft px-4 py-3", className)}>
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{title}</p>
        <p className="text-sm text-ink-muted">{body}</p>
      </div>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-accent-ink hover:bg-white/60">
          <RotateCcw className="size-4" aria-hidden /> Try again
        </button>
      ) : null}
    </div>
  );
}

export function SectionHeader({ title, action, className, as: As = "h2" }: { title: string; action?: React.ReactNode; className?: string; as?: "h2" | "h3" }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <As className="text-lg font-semibold text-ink sm:text-xl">{title}</As>
      {action}
    </div>
  );
}

export function PageTitle({ title, subtitle, action, className }: { title: string; subtitle?: string; action?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[28px] leading-tight text-ink sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-[15px] text-ink-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Avatar({ name, src, size = 40, className, ring }: { name: string; src?: string | null; size?: number; className?: string; ring?: boolean }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "·";
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) };
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} style={style} className={cn("shrink-0 rounded-full object-cover", ring && "ring-2 ring-white", className)} />
  ) : (
    <span aria-hidden style={style} className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-ink", ring && "ring-2 ring-white", className)}>
      {initials}
    </span>
  );
}

export function AvatarStack({ people, size = 28, max = 4 }: { people: Array<{ name: string; src?: string | null }>; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  return (
    <span className="flex -space-x-2">
      {shown.map((p, i) => (
        <Avatar key={i} name={p.name} src={p.src} size={size} ring />
      ))}
      {people.length > max ? (
        <span className="inline-flex items-center justify-center rounded-full bg-[#f3efe9] text-xs font-medium text-ink-muted ring-2 ring-white" style={{ width: size, height: size }}>
          +{people.length - max}
        </span>
      ) : null}
    </span>
  );
}
